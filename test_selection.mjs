import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {canLock,hits,makeTrial,roadCounts,roadStats,summary} from './selection-engine.js';
import {makeCompoundV15} from './multiwindow.js';
const history=JSON.parse(fs.readFileSync('history.json','utf8'));
for(const game of ['ssq','dlt']){
 test(game+' same-budget arms and nested pool are reproducible',()=>{
  const rows=history[game].slice(1,301);
  const trial=makeTrial(rows,game,'analyst'),legacy=makeCompoundV15(rows,game,'analyst');
  assert.deepEqual(trial.arms.base,{main:legacy.main,extra:legacy.extra});
  for(const t of Object.values(trial.arms)){
   assert.equal(t.main.length,game==='ssq'?8:7);assert.equal(t.extra.length,game==='ssq'?1:2);
  }
  for(let i=1;i<3;i++)for(const p of ['main','extra'])assert.ok(trial.stages[i][p].every(n=>trial.stages[i-1][p].includes(n)));
  assert.deepEqual(trial,makeTrial(rows,game,'analyst'));
  const stats=roadStats(rows,game);
  assert.equal(stats.sample,30);assert.equal(stats.main.total,30*(game==='ssq'?6:5));
  assert.deepEqual(roadCounts([1,4,8,9,11]),[1,2,2]);
  const result=summary([{trial,draw:history[game][0]}]);
  assert.deepEqual(result.rows.base,hits(trial.arms.base,history[game][0]));
  assert.deepEqual(result.rows.base.map((x,i)=>x-result.rows.off[i]),result.gained.map((x,i)=>x-result.lost[i]));
 });
}
test('cutoff, stale base and already settled draws cannot create new public records',()=>{
 const r={status:'pending',targetDate:'2026-11-19',baseIssue:'2026132',createdAt:'2026-11-18T00:00:00Z'};
 const latest={issue:r.baseIssue,date:'2026-11-17'};
 assert.ok(canLock(r,new Date('2026-11-19T10:59:59Z'),latest));
 assert.ok(!canLock(r,new Date('2026-11-19T11:00:00Z'),latest));
 assert.ok(!canLock(r,new Date('2026-11-18T10:00:00Z'),{...latest,issue:'2026133'}));
 assert.ok(!canLock({...r,status:'settled'},new Date('2026-11-18T10:00:00Z'),latest));
});
