import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectInventory} from '../scripts/deployment-audit.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const ci=fs.readFileSync(path.join(root,'.github/workflows/smoke.yml'),'utf8');

test('browser assets are locally present and in the offline precache',()=>{
 const inventory=inspectInventory(root);
 assert.ok(inventory.assets.length>=20);
 assert.ok(inventory.references.length>=10);
 assert.ok(inventory.references.includes('./game-shell.css'));
 assert.ok(inventory.assets.includes('./oura-steps.js'));
});

test('new local script missing from the precache fails the build',()=>{
 const changed=html.replace('</head>','<script src="./new-feature.js"></script></head>');
 assert.throws(()=>inspectInventory(root,changed,sw),/missing local file/);
});

test('nightly regression and deployed-site checks exist with read-only permissions',()=>{
 assert.match(ci,/schedule:\s*\n\s*-\s*cron:\s*'37 17 \* \* \*'/);
 assert.match(ci,/run: node scripts\/deployment-audit\.mjs --local/);
 assert.match(ci,/run: node scripts\/deployment-audit\.mjs\s*$/m);
 assert.match(ci,/contents: read/);
 assert.doesNotMatch(ci,/contents: write/);
});

test('main pushes always run CI even when only modular JS or CSS changes',()=>{
 const pushBlock=ci.split('\n  push:')[1].split('\npermissions:')[0];
 assert.match(pushBlock,/branches: \[main\]/);
 assert.doesNotMatch(pushBlock,/paths:|paths-ignore:/);
});
