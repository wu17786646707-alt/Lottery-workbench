import test from 'node:test';
import assert from 'node:assert/strict';
import {outerAudit} from './outer-audit.js';
const p={stages:[{main:[9],extra:[5]}],evidence:[[9,3,0,4,6,.42],[33,3,0,4,6,.42]],rearEvidence:[[5,2,1,3,4,.7]]};
test('joint outer audit identifies deterministic ties and covered zones',()=>{
 const s=outerAudit(p,{main:[33],extra:[5]});
 assert.ok(s.includes('33 · 综合第 2'));assert.ok(s.includes('按号码升序'));assert.ok(s.includes('副区全部入围'));
 assert.equal(outerAudit(p,null),'');
});
