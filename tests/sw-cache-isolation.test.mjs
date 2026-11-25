import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('activation removes only obsolete Habit Quest caches',async()=>{
 const handlers={},deleted=[];
 const self={addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:()=>Promise.resolve()}};
 const caches={keys:async()=>['habit-quest-offline-v18-group-boss-steps','habit-quest-offline-v19-cache-isolation','other-app-cache'],delete:async key=>{deleted.push(key);return true}};
 vm.runInNewContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,caches});
 let pending;
 handlers.activate({waitUntil:p=>pending=p});
 await pending;
 assert.deepEqual(deleted,['habit-quest-offline-v18-group-boss-steps']);
});
