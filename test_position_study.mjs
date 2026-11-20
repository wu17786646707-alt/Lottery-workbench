import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {aggregate,positionScore,positionTrial,updatePositionStudy} from './position-study.js';

const sample=Array.from({length:330},(_,i)=>({issue:String(2026330-i),date:'2026-11-19',main:[3,9,16,20,25,30],extra:[5]}));
const pool={main:[1,2,4,5,6,7,8,9,10,11,12,13,14,15,16]};
const base={main:[1,2,4,5,6,7,9,16],extra:[2]};
const veteran={stages:[pool,base],arms:{random:{main:[1,2,3,4,5,6,7,8],extra:[1]}}};
test('pool-external additions, four-core protection, budget and unchanged blue',()=>{
 const p=positionTrial(sample,veteran);
 assert.deepEqual(p.aims.map(a=>a.number),[3,30]);assert.equal(p.revised.length,8);assert.equal(new Set(p.revised).size,8);
 for(const a of p.aims){assert.ok(!p.pool.includes(a.number));assert.ok(p.revised.includes(a.number));assert.ok(p.base.includes(a.dropped));assert.ok(!p.gold.includes(a.dropped));}
 assert.equal(p.gold.length,4);assert.ok(p.gold.every(n=>p.pool.includes(n)));assert.equal(p.blue,2);
 assert.deepEqual(p.blueStages.map(x=>x.length),[8,4,1]);assert.ok(p.blueStages[2].every(n=>p.blueStages[1].includes(n)));assert.ok(p.blueStages[1].every(n=>p.blueStages[0].includes(n)));
 const s=positionScore(p,sample[0]);assert.equal(s.delta,2);assert.ok(s.headExact&&s.tailExact);assert.deepEqual(aggregate([s]).blueSteps,[1,1,1]);
 const inside=positionTrial(sample,{...veteran,stages:[{main:[...pool.main,3,30]},base]});
 assert.deepEqual(inside.base,inside.revised);
});
test('a supplemental lock is timestamped at creation, never after cutoff or twice',()=>{
 const record={game:'ssq',targetDate:'2026-11-22',createdAt:'2026-11-19T13:00:00Z',status:'pending',baseIssue:sample[0].issue};
 const lock={...record,byMode:{veteran}};
 const data={locks:[lock],positionStudy:{policy:'ssq-position-v1',replay:{last:sample[0].issue},locks:[]}};
 const original=JSON.stringify(data.locks);
 updatePositionStudy(data,sample,[record],new Date('2026-11-22T11:00:00Z'));
 assert.equal(data.positionStudy.locks.length,0);
 updatePositionStudy(data,sample,[record],new Date('2026-11-21T03:00:00Z'));
 const before=JSON.stringify(data);
 updatePositionStudy(data,sample,[record],new Date('2026-11-22T02:00:00Z'));
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify(data.locks),original);
 assert.equal(data.positionStudy.locks[0].createdAt,'2026-11-21T03:00:00.000Z');
});
test('real archive replay totals reconcile',()=>{
 const replay=JSON.parse(fs.readFileSync('selection-data.json')).positionStudy.replay;
 assert.equal(replay.n,30);assert.equal(replay.n,replay.better+replay.worse+replay.tie);
 assert.equal(replay.n,replay.hist.reduce((a,b)=>a+b));assert.equal(replay.goldHits,replay.hist.reduce((a,v,i)=>a+v*i,0));
});
