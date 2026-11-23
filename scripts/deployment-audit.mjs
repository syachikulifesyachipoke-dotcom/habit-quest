/* Public-deployment integrity check. No logins, tokens, or user data needed. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEFAULT_SITE='https://syachikulifesyachipoke-dotcom.github.io/habit-quest/';

export function inspectInventory(root=ROOT, htmlSource, workerSource){
 const html=htmlSource??fs.readFileSync(path.join(root,'index.html'),'utf8');
 const worker=workerSource??fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const found=worker.match(/\bconst ASSETS=(\[[^\r\n]+?\]);/);
 if(!found)throw new Error('Service worker ASSETS list missing or not a JSON array');
 const assets=JSON.parse(found[1]);
 if(!Array.isArray(assets)||!assets.length)throw new Error('Empty service worker precache');
 const unique=new Set(assets);
 if(unique.size!==assets.length)throw new Error('Duplicate service worker precache entries');
 for(const item of assets){
  if(typeof item!=='string'||!item.startsWith('./')||item.includes('?')||item.includes('#')||item.includes('..'))
   throw new Error('Unsafe or invalid precache path: '+item);
  if(item!=='./'&&!fs.existsSync(path.join(root,item)))
   throw new Error('Missing precached file: '+item);
 }
 const beforeInlineScript=html.split('<script>')[0];
 const references=[...beforeInlineScript.matchAll(/<(?:link|script)\b[^>]*?\b(?:href|src)="(\.\/[^"?#]+)(?:\?[^"]*)?"/g)]
  .map(m=>m[1]);
 for(const ref of references){
  if(!fs.existsSync(path.join(root,ref)))throw new Error('HTML references missing local file: '+ref);
  if(!unique.has(ref))throw new Error('HTML references an asset missing from offline cache: '+ref);
 }
 for(const required of ['./','./index.html','./manifest.webmanifest','./cloud-config.js']){
  if(!unique.has(required))throw new Error('Required offline asset not cached: '+required);
 }
 return {assets, references};
}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function compareAsset(base,relative,root,attempts=2){
 const url=new URL(relative,base);
 const file=relative==='./'?'index.html':relative.replace(/^\.\//,'');
 const expected=fs.readFileSync(path.join(root,file));
 let failure;
 for(let tryIndex=0;tryIndex<attempts;tryIndex++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'cache-control':'no-cache'}});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const received=Buffer.from(await response.arrayBuffer());
   if(!expected.equals(received))throw new Error('Published content differs from main');
   return;
  }catch(error){
   failure=error;
   if(tryIndex+1<attempts)await delay(1000);
  }
 }
 throw new Error(file+': '+failure.message+' ('+url.href+')');
}

export async function checkDeployment(root=ROOT,site=DEFAULT_SITE){
 const {assets}=inspectInventory(root);
 const base=new URL(site);
 if(base.protocol!=='https:')throw new Error('Site URL must use HTTPS');
 // The root page is served by GitHub Pages; compare its canonical index.html.
 const paths=[...new Set(['./index.html','./sw.js',...assets.filter(x=>x!=='./')])];
 const errors=[];
 for(const item of paths){
  try{await compareAsset(base,item,root)}
  catch(error){errors.push(error.message);console.error('FAIL',error.message)}
 }
 if(errors.length)throw new Error(errors.length+' of '+paths.length+' public assets failed verification');
 return paths.length;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {assets,references}=inspectInventory();
  console.log('Local PWA inventory OK:',assets.length,'cached assets,',references.length,'HTML references');
  if(!process.argv.includes('--local')){
   const checked=await checkDeployment(ROOT,process.env.HABIT_QUEST_SITE_URL||DEFAULT_SITE);
   console.log('Published GitHub Pages deployment OK:',checked,'files match the repository');
  }
 }catch(error){console.error(error);process.exitCode=1}
}
