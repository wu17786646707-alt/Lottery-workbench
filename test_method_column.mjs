import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('./method-column.html',import.meta.url),'utf8');
const data=html.match(/<script id="snapshot"[^>]*>(.*?)<\/script>/s)[1];
const source=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function openColumn() {
 const fields=new Map();
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
 function field(id) {
  assert(ids.has(id),'missing page element '+id);
  if(!fields.has(id))fields.set(id,{dataset:{},value:'',innerHTML:'',textContent:'',
   replaceChildren(...options){this.value=options[0]?.value || '';}});
  return fields.get(id);
 }
 field('snapshot').textContent=data;
 const buttons=['dlt','ssq'].map(game=>({dataset:{game},setAttribute(){}}));
 const context=vm.createContext({document:{getElementById:field,querySelectorAll:()=>buttons},
  location:{protocol:'file:'},Option:class {constructor(label,value){this.value=value;}}});
 const run=code=>vm.runInContext(code,context);
 run(source);
 return {field,buttons,run,context};
}

test('both games show the cutoff, selected balls, ranks, stages and replay in the packaged column',()=>{
 const {field,buttons}=openColumn();
 for(const [index,name,mainCount,extraCount] of [[0,'后区',5,2],[1,'蓝球',6,1]]) {
  buttons[index].onclick();
  const text=field('handResult').innerHTML;
  assert(text.includes(name+'为什么选'));
  assert(text.includes('基准期'));assert(text.includes('排名变化'));
  const numbers=text.match(/<h3>参考单式<\/h3><p class="num">([^<]+)/)[1].split('+').map(part=>part.trim().split(/\s+/));
  assert.equal(numbers[0].length,mainCount);assert.equal(numbers[1].length,extraCount);
  assert.equal(field('pairPanel').hidden,index===1);
  field('handReplay').onclick();assert.match(field('replayResult').textContent,/30 期回放/);
 }
});

test('rear rankings and full-history comparison reproduce a fixed, dated case',()=>{
 const {run,field}=openColumn();
 const ranks=run("byStrength(priorRearDraws('2026-11-25').slice(0,30),'extra',12).slice(0,3)");
 assert.deepEqual(Array.from(ranks,r=>[r.n,r.ten,r.thirty,r.score]),[[9,3,9,12],[6,4,7,11],[4,2,8,10]]);
 const rows="priorRearDraws('2026-11-25')";
 const stat=run('compareRearRules('+rows+')');
 assert.deepEqual(JSON.parse(JSON.stringify(stat)),{overall:[[2000,891,31],[2008,882,32]],triggered:[[133,57,2],[141,48,3]]});
 assert.deepEqual(Array.from(run('priorRepeats('+rows+',Infinity)')),[2023,888,40]);
 assert.deepEqual(Array.from(run('priorRepeats('+rows+',30)')),[20,10,0]);
 field('handDate').value='2026-11-25';field('handDate').onchange();field('pairReplay').onclick();
 assert.match(field('handResult').innerHTML,/06 09/);assert.match(field('handResult').innerHTML,/04 09/);
 assert.match(field('pairResult').innerHTML,/31\/2922/);assert.match(field('pairResult').innerHTML,/3\/192/);
});

test('changing target or future draws cannot change historical picks or backtest, gaps are skipped',()=>{
 const {field,run}=openColumn();
 field('handDate').value='2026-11-21';field('handDate').onchange();field('pairReplay').onclick();
 const prefix=()=>field('handResult').innerHTML.split('<p>实际开奖')[0].split('<div class="stage">')[0];
 const prior=prefix(),testResult=field('pairResult').innerHTML;
 run("db.history.dlt=db.history.dlt.map(d=>d.date>='2026-11-21'?{...d,main:[1,2,3,4,5],extra:[2,3]}:d)");
 field('handDate').onchange();field('pairReplay').onclick();
 assert.equal(prefix(),prior);assert.equal(field('pairResult').innerHTML,testResult);
 assert.equal(run("compareRearRules(priorRearDraws('2026-11-25').slice(0,32).filter((_,i)=>i!==10)).overall[0].reduce((s,n)=>s+n,0)"),0);
});

test('source sync retains current built-in draws when the available site file is older',async()=>{
 const {field,run,context}=openColumn();
 const input=JSON.parse(data);
 context.fetch=async path=>({ok:true,json:async()=>path==='history.json'?
  {ssq:input.history.ssq.slice(1),dlt:input.history.dlt.slice(1)}:
  {locks:input.locks.map(r=>({...r,byMode:{veteran:{stages:r.stages}}}))}});
 await run('sync()');assert.equal(field('handDate').value,'2026-11-25');
 assert.match(field('source').textContent,/已读取/);
 assert.match(field('handResult').innerHTML,/06 09/);
});

test('new journal renders separate notes, pre-draw alternatives and retrospective outcomes for both games',()=>{
 const {field,buttons,run}=openColumn();
 for (const [i,g,count,x] of [[0,'dlt',5,2],[1,'ssq',6,1]]){
  buttons[i].onclick();
  const article=field('journalBody').innerHTML;
  assert.match(article,/本期主方案/);assert.match(article,/如果改用另一种分区形态/);
  assert(!article.includes('开奖后对账'));
  assert.equal((field('studyNotes').innerHTML.match(/<summary>/g)||[]).length,10);
  assert.equal(field('studyNotes').innerHTML.includes('彩种错标'),g==='ssq');
  const rows=run('forecastRows().slice(0,30)');
  const model=run('journalPlan(forecastRows().slice(0,30),game)');
  assert.equal(new Set(model.primary.main).size,count);assert.equal(new Set(model.extra).size,x);
  assert.deepEqual(Array.from(model.primary.selected,a=>a.length),Array.from(model.primary.plan.counts));
  field('handDate').value=rows[2].date;field('handDate').onchange();
  assert.match(field('journalBody').innerHTML,/开奖后对账/);
  if(g==='dlt'){assert.match(article,/1\/66/);assert.match(article,/近 10 期同频/);}
  field('journalAll').onclick();assert.match(field('journalReplayResult').textContent,/滚动回放 \d+ 期/);
  field('journalReplay').onclick();assert.match(field('journalReplayResult').textContent,/滚动回放 30 期/);
 }
});
test('conditional slots change the choice: cold reserve needs both extra capacity and active neighbours',()=>{
 const {run,context}=openColumn();
 context.rankFixture=[{n:4,ten:4,thirty:8,near:0},{n:7,ten:3,thirty:5,near:1},{n:5,ten:2,thirty:3,near:1},{n:1,ten:0,thirty:1,near:2}];
 for(const [slots,prev,expected] of [[1,0,[4]],[2,2,[4,5]],[2,1,[4,1]],[3,2,[4,5,1]]]){
  assert.deepEqual(Array.from(run('fillMainBand(rankFixture,'+slots+','+prev+')'),p=>p.r.n),expected);
 }
 context.rankFixture[3].near=1;assert.deepEqual(Array.from(run('fillMainBand(rankFixture,2,1)'),p=>p.r.n),[4,5]);
});
test('the rule-replay article is independent of the outcome and skips a broken 30-draw history',()=>{
 const {run,field}=openColumn();field('handDate').value='2026-11-21';field('handDate').onchange();
 const original=field('journalBody').innerHTML.split('<h3>开奖后对账')[0];
 run("db.history.dlt=db.history.dlt.map(r=>r.date>='2026-11-21'?{...r,main:[1,2,3,4,5],extra:[1,2]}:r)");
 field('handDate').onchange();assert.equal(field('journalBody').innerHTML.split('<h3>开奖后对账')[0],original);
 run("db.history.dlt.splice(10,1)");field('handDate').onchange();assert.match(field('journalBody').textContent,/不完整/);
});
