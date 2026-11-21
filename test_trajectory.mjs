import test from 'node:test';
import assert from 'node:assert/strict';
import {forecast,trace,backtest} from './trajectory.js';
import {update} from './selection-archive.mjs';
const ssq=[
 {issue:'2026132',date:'2026-11-17',main:[5,9,13,17,18,21],extra:[11]},
 {issue:'2026133',date:'2026-11-19',main:[7,10,11,14,21,26],extra:[13]}];
const dlt=[
 {issue:'2026131',date:'2026-11-16',main:[2,11,18,19,29],extra:[4,7]},
 {issue:'2026132',date:'2026-11-18',main:[2,9,16,26,35],extra:[6,11]}];

test('reproduces both published examples and keeps fillers out of geometry',()=>{
  const s=forecast('ssq',...ssq),d=forecast('dlt',...dlt);
  assert.deepEqual(s.main.numbers,[5,9,11,12,13,15]);
  assert.deepEqual(s.extra.numbers,[11]);
  assert.equal(s.main.marks.get(9).rules.length,3);
  assert.deepEqual(d.main.numbers,[7,11,14,18,27]);
  assert.deepEqual(d.extra.numbers,[4,5]);
  assert.deepEqual(d.main.fillers,[27]);
  assert.equal(d.main.marks.has(27),false);
});
test('four-point star and larger horizontal scale, no wrapping, no star on a single ball',()=>{
  for(const d of [1,2]){
    const r=trace([10-d,10+d],[10-2*d,10+2*d],33);
    assert(r.get(10).rules.includes('star'));
    assert(!trace([10-d],[10-2*d,10+2*d],33).get(10)?.rules.includes('star'));
  }
  assert([...trace([2,33],[1,32],33).keys()].every(n=>n>=1&&n<=33));
});
test('backtest predicts before reveal, skips gaps and never uses later draws',()=>{
  const sample=[...ssq,{issue:'2026134',date:'2026-11-22',main:[5,9,11,12,13,15],extra:[11]}];
  const a=backtest('ssq',sample,600);
  assert.equal(a.ticketJackpots,1);assert.equal(a.poolJackpots,1);
  assert.equal(a.stats.main.all.marks,6);assert.equal(a.stats.main.all.hits,6);
  assert.equal(a.stats.main.multi.marks,3);
  assert.deepEqual(a,backtest('ssq',[...sample,{issue:'2026138',date:'2026-12-01'}],600,3));
  const gap=backtest('ssq',[...ssq,{...sample[2],issue:'2026135'}]);
  assert.equal(gap.skipped,1);assert.equal(gap.draws,0);
});
test('pre-draw locks keep the original numbers and respect public cutoff on retry',()=>{
  const history={ssq:[...ssq].reverse(),dlt:[]};
  const rec={game:'ssq',status:'pending',targetDate:'2026-11-22',createdAt:'2026-11-20T02:10:00Z',baseIssue:ssq[1].issue};
  const initial=update(history,[rec],null,new Date('2026-11-21T05:00:00Z'));
  const snapshot=structuredClone(initial.trajectoryLocks);
  update(history,[rec],initial,new Date('2026-11-21T06:00:00Z'));
  assert.deepEqual(initial.trajectoryLocks,snapshot);
  assert.equal(update(history,[rec],null,new Date('2026-11-22T11:00:00Z')).trajectoryLocks,undefined);
});
