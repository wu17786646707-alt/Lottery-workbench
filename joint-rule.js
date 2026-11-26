import {rankFacts,shaped} from './unified-rule.js';
export const JOINT='research-v18.28-joint';
export const factors=['head','tail','size','sum','span'];
const asc=(a,b)=>a-b;
const nums=f=>f.map(x=>x.n).sort(asc);
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
function combinations(pool,k){
  const out=[];
  function take(start,chosen){
    if(chosen.length===k){out.push(chosen);return;}
    for(let i=start;i<=pool.length-(k-chosen.length);i++)take(i+1,[...chosen,pool[i]]);
  }
  take(0,[]);return out;
}
function observe(p,name,max){
  switch(name){
    case 'head':return Math.min(...p);
    case 'tail':return Math.max(...p);
    case 'sum':return p.reduce((a,b)=>a+b,0);
    case 'span':return Math.max(...p)-Math.min(...p);
    case 'size':return p.filter(n=>n>max/2).length;
  }
}
export function jointPlan(history,game,{factor=null,useGold=true,outer=true}={}){
  const rows=history,ssq=game==='ssq',max=ssq?33:35,k=ssq?6:5;
  if(rows.length<30)throw Error('联合方案至少需要30期历史');
  const recent=rows.slice(0,30),last10=recent.slice(0,10),zone=n=>Math.min(2,Math.floor((n-1)/(ssq?11:12)));
  const facts=rankFacts(rows,max,'main',[.55,.45]),rear=rankFacts(rows,ssq?16:12,'extra',ssq?[.55,.45]:[.35,.65]);
  const shape=sample=>{
    const all=sample.flatMap(d=>d.main);
    return {zone,shares:[0,1,2].map(z=>all.filter(n=>zone(n)===z).length/all.length),odd:all.filter(n=>n%2).length/all.length};
  };
  const broad=shape(recent),short=shape(last10);
  function utility(p,s){
    const n=p.length,z=[0,0,0];let odds=0;
    for(const f of p){z[zone(f.n)]++;odds+=f.n%2;}
    const dev=z.reduce((a,v,i)=>a+Math.abs(v/n-s.shares[i]),0)+.5*Math.abs(odds/n-s.odd);
    return mean(p.map(f=>f.score))-.65*dev;
  }
  const big=facts.slice(0,23),mid=shaped(outer?big:facts,15,[],broad,.95);
  const leaders=[0,1,2].map(z=>{
    const [first,second]=mid.filter(f=>zone(f.n)===z).sort((a,b)=>b.score-a.score||a.n-b.n);
    return first&&second&&first.frequencyRank<=10&&first.change>0&&first.score-second.score>=.04?first:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.n-b.n);
  const cap=leaders.length===3&&leaders.every(f=>f.frequencyRank<=6&&f.change>=2)?3:2;
  const gold=useGold?nums(leaders.slice(0,cap)):[];
  const proposals=[broad,short].map(s=>shaped(mid,k+2,gold,s,.95));
  const merits=proposals.map(p=>(utility(p,broad)+utility(p,short))/2);
  const selected=Number(merits[1]>merits[0]),budget=proposals[selected];
  const target=factor?recent.map(d=>observe(d.main,factor,max)):[];
  const center=factor?mean(target):0,scale=factor?Math.max(1,Math.sqrt(mean(target.map(v=>(v-center)**2)))):1;
  let best=null,high=-Infinity;
  for(const subset of combinations([...budget].sort((a,b)=>a.n-b.n),k)){
    if(!gold.every(n=>subset.some(f=>f.n===n)))continue;
    const score=utility(subset,broad)-(factor? .08*Math.abs(observe(nums(subset),factor,max)-center)/scale:0);
    if(score>high){best=subset;high=score;}
  }
  return {gapDepth:rows.length,rule:JOINT,factor,gold,stages:[big,mid,budget,best].map((p,i)=>({main:nums(p),extra:nums(rear.slice(0,[6,4,ssq?2:3,ssq?1:2][i]))})),
    selected,proposals:proposals.map(nums),merits,zoneShares:[broad.shares,short.shares],
    evidence:facts.map(f=>[f.n,f.thirty,f.change,f.frequencyRank,f.trendRank,+f.score.toFixed(4),f.ten,f.miss]),
    rearEvidence:rear.map(f=>[f.n,f.thirty,f.change,f.frequencyRank,f.trendRank,+f.score.toFixed(4),f.ten,f.miss])};
}
export const stageHits=(joint,actual)=>joint.stages.map(p=>({
  main:p.main.filter(n=>actual.main.includes(n)),extra:p.extra.filter(n=>actual.extra.includes(n))
}));
