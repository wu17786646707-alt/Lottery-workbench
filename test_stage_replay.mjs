import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {replayStages} from './replay-stages.js';
import {stagedResearch,modes} from './selection-engine.js';
const h=JSON.parse(fs.readFileSync(new URL('./history.json',import.meta.url)));
for(const game of ['ssq','dlt'])test(game+' held-out replay matches formal plan and excludes the target draw',()=>{
  const rows=h[game].slice(0,330),report=replayStages(rows,game);
  assert.equal(report.draws.length,30);
  for(const i of [0,29])for(const m of modes){
    const actual=rows[i],plan=stagedResearch(rows.slice(i+1,i+301),game,m);
    for(const [j,p] of plan.stages.entries()){
      const view=report.draws[i].byMode[m][j];
      assert.deepEqual(view.main,p.main);assert.deepEqual(view.extra,p.extra);
      assert.deepEqual(view.hits,['main','extra'].map(k=>actual[k].filter(n=>p[k].includes(n)).length));
    }
  }
});
