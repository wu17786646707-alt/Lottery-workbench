import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('./optimizer-v185.html',import.meta.url),'utf8');
const js=src.split('<script>')[1]?.split('</script>')[0];
assert.ok(js,'missing standalone engine');
const {G,choose,prize,exact,rolling,researchers,compoundStats,distinctCoverage}=vm.runInNewContext(js+'\nV185Lib',{});
function near(x,y,eps=0.000000001){assert.ok(Math.abs(x-y)<eps,`${x} != ${y}`)}
test('game combination counts and exact jackpot odds',()=>{
 assert.equal(choose(33,6),1107568);assert.equal(choose(35,5),324632);
 const a=exact('ssq',8,1),b=exact('ssq',7,4),c=exact('dlt',7,2),d=exact('dlt',5,7);
 for(const x of [a,b]){assert.equal(x.cost,56);assert.equal(x.bets,28);near(x.first,28/(1107568*16))}
 for(const x of [c,d]){assert.equal(x.cost,42);assert.equal(x.bets,21);near(x.first,21/(324632*66))}
});
test('exact chance at least one standard prize, checked independently',()=>{
 near(exact('ssq',8,1).any,0.08148416169481242);
 near(exact('ssq',7,4).any,0.2580771564364445);
 near(exact('dlt',7,2).any,0.12254281211284834);
 near(exact('dlt',5,7).any,0.3939573630038526);
});
test('both shapes have exactly the same expected winning ticket count',()=>{
 near(exact('ssq',8,1).expectedWinningTickets,exact('ssq',7,4).expectedWinningTickets);
 near(exact('dlt',7,2).expectedWinningTickets,exact('dlt',5,7).expectedWinningTickets);
});
test('2026 prize patterns and special conditions',()=>{
 assert.equal(prize('dlt',0,2),7);assert.equal(prize('dlt',2,1),7);assert.equal(prize('dlt',3,0),7);
 assert.equal(prize('dlt',1,1),0);assert.equal(prize('ssq',0,1),6);assert.equal(prize('ssq',3,0),0);
 assert.equal(prize('ssq',6,1),1);assert.equal(prize('dlt',5,2),1);
});
test('reject invalid bets and insufficient history',()=>{
 assert.throws(()=>exact('ssq',5,1));assert.throws(()=>exact('dlt',7,1));
 assert.throws(()=>rolling([{issue:'1',main:[1,2,3,4,5,6]}],'ssq'));
});
test('rolling history strictly uses previous rows, not current draw',()=>{
 const rows=[];for(let i=1;i<=1232;i++)rows.push({issue:String(i).padStart(7,'0'),main:[1,2,3,4,5,6]});
 let a=rolling(rows,'ssq'),b=rolling(rows,'ssq');assert.equal(a.length,4);assert.deepEqual(a,b);
 assert.equal(a.at(-1).hot,6);assert.equal(a.at(-1).cold,0);
});
test('formal records only include settled predictions, no retrospective claims',()=>{
 const records=[{game:'ssq',status:'settled',policy:'x',actual:{main:[1,2,3,4,5,6],extra:[1]},picks:[{mode:'analyst',main:[1,2,7,8,9,10],extra:[1]},{mode:'veteran',main:[2,3,7,8,9,10],extra:[1]}]},
 {game:'ssq',status:'pending',picks:[{mode:'analyst',main:[1,2,3,4,5,6],extra:[1]}]}];
 const x=researchers(records,'ssq');assert.equal(x[0].n,1);assert.equal(x[0].main,2);assert.equal(x[0].extra,1);assert.equal(distinctCoverage(records,'ssq').same,1);
});

test('same-cost compound ledger counts distributed prizes without fabricated random history',()=>{
 const s={game:'ssq',status:'settled',actual:{main:[1,2,3,4,5,6],extra:[12]},compoundPicks:[{mode:'trend',main:[1,9,10,11,12,13,14,15],extra:[12],cost:56}]};
 const d={game:'dlt',status:'settled',actual:{main:[2,12,14,17,33],extra:[7,8]},compoundPicks:[{mode:'veteran',main:[4,10,12,17,21,24,25],extra:[4,7],cost:42}]};
 const x=compoundStats([s],'ssq');assert.equal(x.find(x=>x.mode==='trend').winningTickets,28);
 assert.equal(x.find(x=>x.mode==='random').n,0);
 const y=compoundStats([d],'dlt');assert.equal(y.find(x=>x.mode==='veteran').winningTickets,10);
});
