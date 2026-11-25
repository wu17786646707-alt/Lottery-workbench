import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {run} from './automation_research.mjs';
import {stagedResearch, researcherPlan, makeTrial, processPolicy, modes} from './selection-engine.js';

const history=JSON.parse(fs.readFileSync(new URL('./history.json',import.meta.url)));
for(const game of ['ssq','dlt']){
 test(game+' official tickets follow the same ranked pool in all three stages',()=>{
  const rows=history[game].slice(0,300);
  for(const mode of modes){
   const plan=stagedResearch(rows,game,mode);
   assert.equal(plan.source.main.length,23);assert.equal(plan.stages[0].main.length,15);
   assert.equal(plan.compound.cost,game==='ssq'?112:126);
   assert.ok(plan.gold.every(n=>plan.single.main.includes(n)));
   assert.deepEqual(plan.single.main,plan.compound.single);
   for(const part of ['main','extra']){
    assert.deepEqual(plan.single[part],plan.stages[2][part]);
    assert.deepEqual(plan.compound[part],plan.stages[1][part]);
    assert.ok(plan.single[part].every(n=>plan.compound[part].includes(n)));
    assert.ok(plan.compound[part].every(n=>plan.stages[0][part].includes(n)));
   }
  }
 });
}
test('revise pending tickets once, then settle the last public version',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'formal-picks-'));
 try{
  const start='2026-11-18';
  const input={...history};
  for(const game of ['dlt','ssq'])input[game]=history[game].filter(d=>d.date<=start).slice(0,330);
  const draws=path.join(root,'history.json'),log=path.join(root,'research.json');
  fs.writeFileSync(draws,JSON.stringify(input));
  const now=new Date('2026-11-19T02:00:00Z');
  run(now,root);
  const first=JSON.parse(fs.readFileSync(log));
  assert.equal(first.records.length,2);
  for(const r of first.records){
   assert.equal(r.policy,processPolicy);
   for(const mode of modes){
    const plan=researcherPlan(input[r.game],r.game,mode,r);
    assert.ok(plan.single.published);
    assert.deepEqual(plan.single.main,r.stagesByMode[mode][2].main);
    assert.deepEqual(plan.compound.extra,r.stagesByMode[mode][1].extra);
   }
  }
  const old=first.records.find(r=>r.game==='dlt');
  delete old.stagesByMode;delete old.revisionKey;old.policy='legacy';
  fs.writeFileSync(log,JSON.stringify(first));
  run(now,root);
  const revised=JSON.parse(fs.readFileSync(log)).records;
  const updated=revised.find(r=>r.game==='dlt');
  assert.equal(updated.policy,processPolicy);assert.equal(updated.revision,2);
  assert.equal(revised.filter(r=>r.game==='dlt').length,1);
  run(now,root);assert.deepEqual(JSON.parse(fs.readFileSync(log)).records,revised);
  input.ssq=history.ssq.filter(d=>d.date<='2026-11-19').slice(0,330);
  fs.writeFileSync(draws,JSON.stringify(input));run(new Date('2026-11-20T02:00:00Z'),root);
  const latest=JSON.parse(fs.readFileSync(log)).records;
  assert.deepEqual(latest.find(r=>r.id===updated.id),updated);
  const settled=latest.find(r=>r.game==='ssq'&&r.targetDate==='2026-11-19');
  assert.equal(settled.status,'settled');
  for(const mode of modes)for(const part of ['main','extra'])
   assert.equal(settled.outcome[mode][part],settled.stagesByMode[mode][2][part].filter(n=>settled.actual[part].includes(n)).length);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
