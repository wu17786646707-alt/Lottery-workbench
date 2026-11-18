import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('./pool-lab-v186.html',import.meta.url),'utf8');
const pure=html.match(/<script id="pool-algorithms">([\s\S]*?)<\/script>/)?.[1];assert.ok(pure);const sandbox=vm.createContext({console});vm.runInContext(pure,sandbox,{filename:'pool-core'});const lib=sandbox.Pool186Core;
const nearly=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function seedDraws(game,n=245){const g=lib.G[game],out=[];for(let i=0;i<n;i++){
 const main=Array.from({length:g.max},(_,j)=>j+1).sort((a,b)=>((a*37+i*13+(a*i)%17)%97)-((b*37+i*13+(b*i)%17)%97)||a-b).slice(0,g.picks).sort((a,b)=>a-b);
 const extra=Array.from({length:g.extraMax},(_,j)=>j+1).sort((a,b)=>((a*13+i*7+(a*i)%5)%83)-((b*13+i*7+(b*i)%5)%83)||a-b).slice(0,g.extraPicks).sort((a,b)=>a-b);
 out.push({issue:String(2026001+i),date:'2026-01-01',main,extra,verification:'test-only'});
}return lib.validRows(game,out)}
for(const game of ['ssq','dlt']){
 const rows=seedDraws(game),c=lib.G[game],m=game==='ssq'?14:13,b=5;
 test(game+' pool covers exactly configured candidate count',()=>{for(const method of ['mix','hot30','cold30','miss','random']){const pool=lib.buildPool(rows,game,method,m,b);assert.equal(pool.main.length,m);assert.equal(pool.extra.length,b);assert.equal(new Set(pool.main).size,m);assert.equal(new Set(pool.extra).size,b);assert.ok(pool.main.every(n=>n>=1&&n<=c.max))}});
 test(game+' repeatable identical no future knowledge',()=>{const one=lib.buildPool(rows.slice(1),game,'mix',m,b),target=rows[0];const changed=[{...target,main:Array.from({length:c.picks},(_,i)=>c.max-i),extra:Array.from({length:c.extraPicks},(_,i)=>i+1)},...rows.slice(1)];const two=lib.buildPool(changed.slice(1),game,'mix',m,b);assert.equal(JSON.stringify(one),JSON.stringify(two));});
 test(game+' rolling 60 only prior 120 draws',()=>{for(const mode of ['mix','hot30','cold30','miss','random']){const stat=lib.evaluate(game,rows,mode,m,b,60);assert.equal(stat.out.length,60);assert.equal(stat.periods,60);assert.equal(stat.out[0].issue,rows[59].issue);assert.equal(stat.out.at(-1).issue,rows[0].issue);const before=lib.evaluate(game,rows,mode,m,b,60);assert.equal(JSON.stringify(stat),JSON.stringify(before))}});
 test(game+' future modification cannot alter earlier 59 results',()=>{const first=lib.evaluate(game,rows,'mix',m,b,60);const clone=JSON.parse(JSON.stringify(rows));clone[0].main=Array.from({length:c.picks},(_,j)=>j+1);const second=lib.evaluate(game,clone,'mix',m,b,60);assert.equal(JSON.stringify(first.out.slice(0,-1)),JSON.stringify(second.out.slice(0,-1)))});
 test(game+' trajectories use only actual historical draws',()=>{const x=lib.trajectories(rows,game,60);assert.equal(x.length,c.max);assert.equal(x.reduce((s,v)=>s+v.count60,0),60*c.picks);assert.equal(x.reduce((s,v)=>s+v.count30,0),30*c.picks)});
}
test('SSQ chance red14 blue5 exact',()=>nearly(lib.coverage('ssq',14,5),lib.choose(14,6)/lib.choose(33,6)*5/16));
test('DLT chance front13 back5 exact',()=>nearly(lib.coverage('dlt',13,5),lib.choose(13,5)/lib.choose(35,5)*lib.choose(5,2)/lib.choose(12,2)));
test('Single ticket odds unchanged',()=>{assert.equal(lib.choose(33,6)*16,17721088);assert.equal(lib.choose(35,5)*lib.choose(12,2),21425712)});
test('Bad data fails closed',()=>{let rows=seedDraws('ssq');rows[0].extra=[22];assert.throws(()=>lib.validRows('ssq',rows))});
test('No synthetic winning numbers or future personal predictions in output artifact',()=>{assert.match(html,/不能保证提高一等奖概率/);assert.match(html,/赛前截断/);assert.doesNotMatch(html,/模拟开奖数据/)});
