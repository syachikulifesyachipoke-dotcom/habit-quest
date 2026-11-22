import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const base = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = createClient(base,key,{auth:{autoRefreshToken:false,persistSession:false}});
const url = new URL(import.meta.url);
const redirect = Deno.env.get("OURA_REDIRECT_URI") || (base+"/functions/v1/oura-service/callback");
const site = Deno.env.get("HABIT_SITE_URL") || "https://syachikulifesyachipoke-dotcom.github.io/habit-quest/";
const cid = Deno.env.get("OURA_CLIENT_ID") || "087cf695-9e9f-4747-96f0-ae3482805110";
const secret = Deno.env.get("OURA_CLIENT_SECRET") || "";
const cryptoKey = Deno.env.get("OURA_TOKEN_KEY") || "";
function headers(req){ const origin=req.headers.get("origin")||""; const allowed=(site && origin===new URL(site).origin) || /^http:\/\/localhost(:[0-9]+)?$/.test(origin); return {"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":allowed?origin:"null","Vary":"Origin","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info"}; }
function json(req,data,code=200){return new Response(JSON.stringify(data),{status:code,headers:headers(req)})}
function hash(v){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)).then(a=>Array.from(new Uint8Array(a)).map(x=>x.toString(16).padStart(2,"0")).join(""))}
async function aesKey(){ const raw=Uint8Array.from(atob(cryptoKey),x=>x.charCodeAt(0)); if(raw.length!==32)throw Error("Invalid encryption key");return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"])}
async function enc(t){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:"AES-GCM",iv},await aesKey(),new TextEncoder().encode(t));return btoa(String.fromCharCode(...iv,...new Uint8Array(bytes)))}
async function dec(t){const b=Uint8Array.from(atob(t),x=>x.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(0,12)},await aesKey(),b.slice(12)))}
async function token(body){const r=await fetch("https://api.ouraring.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"HabitQuest/1.0"},body:new URLSearchParams({...body,client_id:cid,client_secret:secret}),signal:AbortSignal.timeout(15000)});if(!r.ok){const detail=await r.json().catch(()=>({}));const e=new Error("Oura token exchange failed ("+r.status+")");e.ouraCode=detail.error||"";e.status=r.status;throw e;}const j=await r.json();if(!j.access_token||!j.refresh_token)throw Error("Incomplete Oura token response");return j}
async function configurationStatus(){
 const issues=[];
 if(!cid)issues.push("OURA_CLIENT_ID");
 if(!secret)issues.push("OURA_CLIENT_SECRET");
 if(!cryptoKey)issues.push("OURA_TOKEN_KEY");
 else try{await aesKey()}catch(_){issues.push("OURA_TOKEN_KEY の形式：32バイトのBase64が必要")}
 if(!site)issues.push("HABIT_SITE_URL");
 return {configured:issues.length===0,issues};
}
async function user(req){const header=req.headers.get("authorization")||"";if(!header.startsWith("Bearer "))return null;const {data,error}=await admin.auth.getUser(header.slice(7));return error?null:data.user}
async function connected(uid){const {data,error}=await admin.from("oura_connections").select("*").eq("user_id",uid).maybeSingle();if(error)throw error;return data}
async function saveTokens(uid,t,scopes){const {error}=await admin.from("oura_connections").upsert({user_id:uid,access_token_encrypted:await enc(t.access_token),refresh_token_encrypted:await enc(t.refresh_token),expires_at:new Date(Date.now()+Number(t.expires_in||2592000)*1000).toISOString(),scopes,connection_state:"connected",refresh_lock_until:new Date(0).toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error}
async function saveRefreshedTokens(uid,t,scopes,lockUntil){
 const next={
   access_token_encrypted:await enc(t.access_token),
   refresh_token_encrypted:await enc(t.refresh_token),
   expires_at:new Date(Date.now()+Number(t.expires_in||2592000)*1000).toISOString(),
   scopes,connection_state:"connected",
   refresh_lock_until:new Date(0).toISOString(),
   updated_at:new Date().toISOString()
 };
 // Never INSERT a row during token rotation: a user may have disconnected in parallel.
 const {data,error}=await admin.from("oura_connections").update(next)
   .eq("user_id",uid).eq("refresh_lock_until",lockUntil).select("user_id");
 if(error)throw error;
 if(!data?.length)throw Error("Oura token update was cancelled because the connection was removed or replaced.");
}
async function refresh(uid,con){
 const now=new Date(),lockUntil=new Date(Date.now()+60000).toISOString();
 const {data:lock,error}=await admin.from("oura_connections")
   .update({refresh_lock_until:lockUntil}).eq("user_id",uid)
   .lt("refresh_lock_until",now.toISOString()).select("user_id");
 if(error)throw error;
 if(!lock?.length){
   // Another device is refreshing a single-use token. Re-check before reporting an error.
   for(let i=0;i<6;i++){
     await new Promise(resolve=>setTimeout(resolve,500*(i+1)));
     const latest=await connected(uid);
     if(latest?.connection_state==="reauth_required")throw Error("Oura reconnection required");
     if(latest&&Date.parse(latest.expires_at)-Date.now()>180000)
       return await dec(latest.access_token_encrypted);
   }
   throw Error("Oura token refresh is running. Please retry shortly.");
 }
 try{
   // A second device can acquire a lock after another device has already rotated the token.
   // Always fetch the row again while holding the refresh lock.
   const current=await connected(uid);
   if(!current)throw Error("Oura connection missing");
   if(current.connection_state!=="connected")throw Error("Oura reconnection required");
   if(Date.parse(current.expires_at)-Date.now()>180000)
     return await dec(current.access_token_encrypted);
   const t=await token({grant_type:"refresh_token",refresh_token:await dec(current.refresh_token_encrypted)});
   // Refresh tokens are one-time-use. Retry persisting the NEW pair, never retry the exchange.
   let saveError;
   for(let attempt=0;attempt<3;attempt++){
     try{await saveRefreshedTokens(uid,t,current.scopes,lockUntil);saveError=null;break}
     catch(e){saveError=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)))}
   }
   if(saveError)throw Error("Oura issued new tokens, but saving failed. Reconnect Oura before syncing.");
   return t.access_token;
 }catch(e){
   if(e?.ouraCode==="invalid_grant"){
     await admin.from("oura_connections").update({connection_state:"reauth_required"})
       .eq("user_id",uid).eq("refresh_lock_until",lockUntil);
   }
   throw e;
 }finally{
   await admin.from("oura_connections").update({refresh_lock_until:new Date(0).toISOString()})
      .eq("user_id",uid).eq("refresh_lock_until",lockUntil);
 }
}
async function getAccess(uid){let con=await connected(uid);if(!con)throw Error("Oura not connected");if(con.connection_state!=="connected")throw Error("Oura reconnection required");return {access:Date.parse(con.expires_at)-Date.now()>180000?await dec(con.access_token_encrypted):await refresh(uid,con),scopes:con.scopes}}
function shiftedDay(day,delta){const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10)}
async function collect(type,start,end,access){let next=null;const rows=[];const padded=["daily_activity","sleep","workout"].includes(type);for(let i=0;i<12;i++){const u=new URL("https://api.ouraring.com/v2/usercollection/"+type);u.searchParams.set("start_date",padded?shiftedDay(start,-1):start);u.searchParams.set("end_date",padded?shiftedDay(end,1):end);if(next)u.searchParams.set("next_token",next);const r=await fetch(u,{headers:{Authorization:"Bearer "+access,"User-Agent":"HabitQuest/1.0"},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("Oura "+type+" API "+r.status);const j=await r.json();rows.push(...(j.data||[]).filter(x=>{const day=x.day||(type==="workout"?(x.start_datetime||x.start_time||"").slice(0,10):"");return day>=start&&day<=end}));next=j.next_token;if(!next)return rows}throw Error("Pagination limit reached")}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
 const path=new URL(req.url);const action=path.pathname.endsWith("/callback")?"callback":(path.searchParams.get("action")||"status");
 if(action==="callback"){
  const params=new URL(req.url).searchParams;const state=params.get("state")||"";const code=params.get("code")||"";
  const dest=(site||"https://example.invalid/").replace(/\/$/,"")+"/";
  if(!state||(!code&&!params.get("error")))return new Response("Invalid OAuth callback",{status:400});
  try{
   const h=await hash(state);const {data,error}=await admin.from("oura_oauth_states").delete().eq("state_hash",h).gt("expires_at",new Date().toISOString()).select("user_id,code_verifier_encrypted");if(error||data?.length!==1)return Response.redirect(dest+"?oura=expired",302);
   if(params.get("error"))return Response.redirect(dest+"?oura=denied",302);
   if(!cid||!secret||!cryptoKey||!site)throw Error("Not configured");
   const t=await token({grant_type:"authorization_code",code,redirect_uri:redirect,code_verifier:await dec(data[0].code_verifier_encrypted)});
   await saveTokens(data[0].user_id,t,(params.get("scope")||"daily workout").split(" "));
   return Response.redirect(dest+"?oura=connected",302);
  }catch(_e){return Response.redirect(dest+"?oura=failed",302)}
 }
 const u=await user(req);if(!u)return json(req,{error:"Please sign in"},401);
 try{
  if(action==="status"){const c=await connected(u.id);const cfg=await configurationStatus();return json(req,{connected:!!c&&c.connection_state==="connected",reauth_required:c?.connection_state==="reauth_required",configured:cfg.configured,setup_issues:cfg.issues,scopes:c?.scopes||[]})}
  if(action==="disconnect"){
   if(req.method!=="POST")return json(req,{error:"POST required"},405);
   // Remove only the caller's server-side credentials. Historical metrics remain.
   // Oura-side consent must also be revoked from the Oura connected-apps page.
   // Invalidate any pending OAuth callback as well, so it cannot reconnect after disconnect.
   const {error:stateError}=await admin.from("oura_oauth_states").delete().eq("user_id",u.id);
   if(stateError)throw stateError;
   const {error}=await admin.from("oura_connections").delete().eq("user_id",u.id);
   if(error)throw error;
   return json(req,{ok:true,disconnected:true,oura_side_revocation:"user_action_required"});
  }
  if(action==="start"){
   const cfg=await configurationStatus();if(!cfg.configured)return json(req,{error:"Oura configuration incomplete: "+cfg.issues.join(", ")},503);
   const random=crypto.getRandomValues(new Uint8Array(32));const state=Array.from(random).map(x=>x.toString(16).padStart(2,"0")).join("");
   const verifier=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,"0")).join("");const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");const {error}=await admin.from("oura_oauth_states").insert({user_id:u.id,state_hash:await hash(state),code_verifier_encrypted:await enc(verifier),expires_at:new Date(Date.now()+10*60*1000).toISOString()});if(error)throw error;
   const auth=new URL("https://cloud.ouraring.com/oauth/authorize");auth.searchParams.set("response_type","code");auth.searchParams.set("client_id",cid);auth.searchParams.set("redirect_uri",redirect);auth.searchParams.set("scope","daily workout");auth.searchParams.set("state",state);auth.searchParams.set("code_challenge",challenge);auth.searchParams.set("code_challenge_method","S256");return json(req,{authorization_url:auth.toString()});
  }
  if(action==="sync"){
   const params=new URL(req.url).searchParams;const end=params.get("end")||new Date().toISOString().slice(0,10);const start=params.get("start")||new Date(Date.now()-7*86400000).toISOString().slice(0,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||Date.parse(end)-Date.parse(start)>32*86400000)return json(req,{error:"Provide valid start/end, up to 32 days"},400);
   const {access,scopes}=await getAccess(u.id);if(!scopes.includes("daily"))return json(req,{error:"Oura daily permission is missing. Reconnect and authorize daily scope."},403);
   const [sl,re,ac]=await Promise.all([collect("daily_sleep",start,end,access),collect("daily_readiness",start,end,access),collect("daily_activity",start,end,access)]);
   const days=new Map();const row=(day)=>{if(!days.has(day))days.set(day,{user_id:u.id,day});return days.get(day)};
   for(const x of sl)if(x.day)row(x.day).sleep_score=x.score??null;
   for(const x of re)if(x.day)row(x.day).readiness_score=x.score??null;
   for(const x of ac)if(x.day)row(x.day).steps=x.steps??null;
   // Detailed sleep periods carry bedtime_end, which is a proxy for waking time.
   try{
     const periods=await collect("sleep",start,end,access);
     const primarySleep=new Map();
     for(const x of periods){
       // A sleep day may include naps; select the primary (long_sleep) period.
       if(!x.day||!x.bedtime_end)continue;
       if(x.type && x.type!=="long_sleep")continue;
       const duration=Number(x.total_sleep_duration||0);
       if(!Number.isFinite(duration)||duration<3*3600)continue;
       const previous=primarySleep.get(x.day);
       if(!previous||duration>Number(previous.total_sleep_duration||0))primarySleep.set(x.day,x);
     }
     for(const [day,x] of primarySleep){
       const r=row(day);r.wake_time=x.bedtime_end;r.sleep_duration_seconds=Number(x.total_sleep_duration);
     }
   }catch(_e){/* detailed sleep is optional */}
   let values=[...days.values()].map(x=>({...x,synced_at:new Date().toISOString()}));
   if(values.length){
     const {data:previous,error:readError}=await admin.from("oura_daily_metrics").select("day,sleep_score,readiness_score,steps,sleep_duration_seconds,wake_time,raw_source").eq("user_id",u.id).gte("day",start).lte("day",end);
     if(readError)throw readError;
     const known=new Map((previous||[]).map(x=>[x.day,x]));
     values=values.map(x=>{const old=known.get(x.day)||{};const combined={user_id:u.id,day:x.day,synced_at:x.synced_at};for(const k of ["sleep_score","readiness_score","steps","sleep_duration_seconds","wake_time","raw_source"])combined[k]=x[k]??old[k]??(k==="raw_source"?{}:null);return combined});
     const {error}=await admin.from("oura_daily_metrics").upsert(values,{onConflict:"user_id,day"});if(error)throw error
   }
   let count=0;
   if(scopes.includes("workout")){let workouts=[];try{workouts=await collect("workout",start,end,access)}catch(e){if(!String(e).includes("403"))throw e}const items=workouts.filter(x=>x.id).map(x=>({user_id:u.id,oura_id:x.id,start_time:x.start_datetime||null,end_time:x.end_datetime||null,activity:x.activity||null,intensity:x.intensity||null,calories:x.calories||null,synced_at:new Date().toISOString()}));if(items.length){const {error}=await admin.from("oura_workouts").upsert(items,{onConflict:"user_id,oura_id"});if(error)throw error}count=items.length}
   return json(req,{ok:true,days:values.length,workouts:count,start,end});
  }
  return json(req,{error:"Unknown action"},404);
 }catch(e){return json(req,{error:String(e?.message||"Operation failed")},502)}
});