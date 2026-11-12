import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('./audit-v183.html',import.meta.url),'utf8');
const script=html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(script,'Missing inline engine');
const pure=script.slice(0,script.indexOf('const $=id=>'));
const sandbox=vm.createContext({Date,Math,Number,Set,Map,Array,JSON});
vm.runInContext(pure,sandbox,{filename:'audit-v183-inline'});
const {prizeGrade,choose,theoreticalCoverage,gradeSummary,settledOverview,forwardRecordStatus,hits,killRecordAudit,historyChoiceAudit,compoundBreakdown,officialPrizeAudit,officialMatches}=
vm.runInContext('({prizeGrade,choose,theoreticalCoverage,gradeSummary,settledOverview,forwardRecordStatus,hits,killRecordAudit,historyChoiceAudit,compoundBreakdown,officialPrizeAudit,officialMatches})',sandbox);
const actual={issue:'2026129',date:'2026-11-10',main:[3,9,16,20,25,30],extra:[5],verification:'single-source'};
const r={game:'ssq',id:'05e9cd25',status:'settled',createdAt:'2026-11-09T02:55:40.177Z',baseIssue:'2026128',targetDate:'2026-11-10',actual,
 picks:[
 {mode:'analyst',main:[3,4,13,15,24,30],extra:[4],softKills:{main:[8,3,33,7],extra:[13]}},
 {mode:'veteran',main:[2,11,17,22,24,25],extra:[4],softKills:{main:[8,3,33,7],extra:[13]}},
 {mode:'trend',main:[9,10,11,20,22,32],extra:[12],softKills:{main:[8,3,33,7],extra:[13]}},
 {mode:'random',main:[23,25,26,27,28,33],extra:[5]}]};

test('2026 DLT exactly 7 awards and 13 winning patterns',()=>{
 const pairs={'5+2':1,'5+1':2,'5+0':3,'4+2':3,'4+1':4,'4+0':5,'3+2':5,'3+1':6,'2+2':6,'3+0':7,'2+1':7,'1+2':7,'0+2':7};
 for(let m=0;m<=5;m++)for(let e=0;e<=2;e++)assert.equal(prizeGrade('dlt',m,e),pairs[`${m}+${e}`]||0,`${m}+${e}`);
 assert.equal(Object.keys(pairs).length,13);
});
test('SSQ standard ranks, including blue-only sixth',()=>{
 for(let m=0;m<=6;m++)for(let e=0;e<=1;e++){
  let p=prizeGrade('ssq',m,e);
  assert.ok(p>=0&&p<=6);
  if(e===1&&m<3)assert.equal(p,6);
 }
 assert.equal(prizeGrade('ssq',3,1),5);assert.equal(prizeGrade('ssq',4,1),4);
 assert.equal(prizeGrade('ssq',5,1),3);assert.equal(prizeGrade('ssq',6,0),2);assert.equal(prizeGrade('ssq',6,1),1);
});
test('Seven plus four and eight plus one are same cost and same jackpot odds',()=>{
 const a=theoreticalCoverage('ssq',8,1),b=theoreticalCoverage('ssq',7,4);
 assert.equal(a.total,28);assert.equal(b.total,28);assert.equal(a.baseCost,56);assert.equal(b.baseCost,56);
 assert.ok(Math.abs(a.firstPrizeProbability-b.firstPrizeProbability)<1e-14);
 assert.ok(a.anyPrize>0&&a.anyPrize<=1&&b.anyPrize>0&&b.anyPrize<=1);
 assert.ok(Math.abs(a.anyPrize-b.anyPrize)>1e-9);
});
test('Seven plus two and five plus seven are same cost and same jackpot odds',()=>{
 const a=theoreticalCoverage('dlt',7,2),b=theoreticalCoverage('dlt',5,7);
 assert.equal(a.total,21);assert.equal(b.total,21);assert.equal(a.baseCost,42);assert.equal(b.baseCost,42);
 assert.ok(Math.abs(a.firstPrizeProbability-b.firstPrizeProbability)<1e-14);
 assert.ok(a.anyPrize>0&&a.anyPrize<=1&&b.anyPrize>0&&b.anyPrize<=1);
});
test('SSQ 2026129 prospectively locked real modes and random sixth rank',()=>{
 assert.equal(forwardRecordStatus(r).ok,true);
 assert.equal(settledOverview([r],'ssq').n,1);
 assert.equal(prizeGrade('ssq',hits(r.picks[3].main,actual.main),hits(r.picks[3].extra,actual.extra)),6);
 assert.equal(prizeGrade('ssq',hits(r.picks[0].main,actual.main),hits(r.picks[0].extra,actual.extra)),0);
 assert.equal(killRecordAudit(r).mainHits,1);
 const b=historyChoiceAudit([r],'ssq');assert.equal(b.length,4);
 assert.equal(b.find(x=>x.mode==='random').hits,1);
});
test('No post-draw snapshot accepted as prospective',()=>{
 const late={...r,createdAt:'2026-11-10T14:00:00Z'};
 assert.equal(forwardRecordStatus(late).ok,false);
});
test('Combinatorial grade counts sum to exact number of tickets',()=>{
 const d={issue:'2026128',date:'2026-11-09',main:[3,13,20,25,34],extra:[9,12]};
 const b=compoundBreakdown({main:[3,8,10,13,20,24,27],extra:[4,7]},d,'dlt');
 assert.equal(b.total,21);assert.equal(b.distribution.reduce((s,x)=>s+x.tickets,0),21);
 assert.equal(gradeSummary(b.distribution,'dlt').wins,6);
 assert.equal(gradeSummary(b.distribution,'dlt').by[7],6);
 const extra=compoundBreakdown({main:[3,13,20,25,34],extra:[1,2,3,4,9,10,12]},d,'dlt');
 assert.equal(extra.total,21);assert.equal(gradeSummary(extra.distribution,'dlt').by[1],1);
});

const dlt129={game:'dlt',id:'dlt-predraw-26129',status:'settled',createdAt:'2026-11-10T02:57:00.038Z',baseIssue:'2026128',targetDate:'2026-11-11',policy:'research-v17.0-shape-first',actual:{issue:'2026129',date:'2026-11-11',main:[2,12,14,17,33],extra:[7,8],verification:'single-source'},picks:[{mode:'analyst',main:[9,10,13,25,26],extra:[1,12]},{mode:'veteran',main:[4,12,17,24,25],extra:[4,7]},{mode:'trend',main:[12,17,18,25,27],extra:[9,12]},{mode:'random',main:[1,11,13,18,19],extra:[2,5]}],compoundPicks:[{mode:'analyst',main:[9,10,12,13,25,26,29],extra:[1,12]},{mode:'veteran',main:[4,10,12,17,21,24,25],extra:[4,7]},{mode:'trend',main:[6,12,13,17,18,25,27],extra:[9,12]}]};
test('DLT 2026129 actual predraw lock, 10 seventh-tier compound prizes, 50 yuan basic gross',()=>{
 assert.equal(forwardRecordStatus(dlt129).ok,true);assert.equal(officialMatches(dlt129),true);
 assert.equal(prizeGrade('dlt',2,1),7);
 assert.deepEqual(dlt129.picks.map(p=>prizeGrade('dlt',hits(p.main,dlt129.actual.main),hits(p.extra,dlt129.actual.extra))),[0,7,0,0]);
 const expanded=compoundBreakdown(dlt129.compoundPicks[1],dlt129.actual,'dlt');
 assert.equal(expanded.total,21);assert.equal(expanded.mainHits,2);assert.equal(expanded.extraHits,1);
 const won=gradeSummary(expanded.distribution,'dlt');assert.equal(won.wins,10);assert.equal(won.by[7],10);
 const pay=officialPrizeAudit(dlt129,expanded.distribution,expanded.baseCost);
 assert.equal(pay.winningTickets,10);assert.equal(pay.gross,50);assert.equal(pay.net,8);
});
test('Official mismatch blocks draw from scored forward records',()=>{
 const fake=JSON.parse(JSON.stringify(dlt129));fake.actual.main=[1,2,3,4,5];
 assert.equal(officialMatches(fake),false);assert.equal(forwardRecordStatus(fake).ok,false);
 assert.equal(officialPrizeAudit(fake,[{main:2,extra:1,tickets:1}],2),null);
});
test('Only known official payout can be calculated; unknown issues never invented',()=>{
 const other=JSON.parse(JSON.stringify(dlt129));other.actual.issue='2026130';other.targetDate='2026-11-14';
 assert.equal(officialMatches(other),null);
 assert.equal(officialPrizeAudit(other,[{main:2,extra:1,tickets:10}],42),null);
});
