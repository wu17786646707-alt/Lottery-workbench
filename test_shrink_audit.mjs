import test from 'node:test';
import assert from 'node:assert/strict';
import {traceDraw,rearRationale} from './shrink-audit.js';
test('all drawn numbers appear once, at their first removal or final retention',()=>{
 const mk=(main,extra)=>({main,extra});
 const stages=[mk([1,2,3,4],[1,2]),mk([2,3,4],[1,2]),mk([3,4],[2]),mk([4],[2])];
 const trace=traceDraw(stages,mk([1,2,3,4,5],[1,2,3]));
 assert.deepEqual(trace.map(t=>t.main),[[5],[1],[2],[3],[4]]);
 assert.deepEqual(trace.map(t=>t.extra),[[3],[],[1],[],[2]]);
 const why=rearRationale({stages,rearEvidence:[[2,0,0,1,1,.9],[1,0,0,2,2,.1]]});
 assert.ok(why.includes('02</b>　单式保留'));assert.ok(!why.includes('01</b>'));
});
import {retention,removalDiagnosis} from './shrink-audit.js';
test('conditioning uses actual parent hits including an empty-hit parent',()=>{
 assert.deepEqual(retention([1,2,3,4],[2,4],[1,3]),{available:2,kept:0,expected:1});
 assert.deepEqual(retention([1,3],[3],[2]),{available:0,kept:0,expected:0});
});
test('flags pure-score survivors with same gold and same capacity',()=>{
 const stages=[[1,2,3,4],[1,2,3,4],[2,4],[4]].map(main=>({main,extra:[1]}));
 const plan={stages,gold:[4],evidence:[[1],[2],[3],[4]],rearEvidence:[[1]]};
 const s=removalDiagnosis(plan,{main:[1,3],extra:[1]});
 assert.ok(s.includes('01（上层池第1，同胆按分可入围'));assert.ok(s.includes('03（上层池第3，同样名额按分筛选也会落选'));
});
