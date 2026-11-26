import test from 'node:test';import assert from 'node:assert/strict';import {rankFacts} from './unified-rule.js';
test('frequency ignores older draws while omission spans them',()=>{
 const rows=Array.from({length:150},(_,i)=>({main:[i===130?2:1]}));
 const r=rankFacts(rows,3,'main',[.55,.45]);const two=r.find(x=>x.n===2);
 assert.equal(two.freq,0);assert.equal(two.miss,130);assert.equal(r.find(x=>x.n===3).miss,150);
 assert.equal(r[0].ten,10);assert.equal(r[0].miss,0);
});
