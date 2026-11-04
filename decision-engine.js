/** V18 decision evidence and complete, budget-equivalent compound variants.
 * No inference that frequencies predict fair-draw probabilities.
 * All inputs are real history, newest first; rolling tests use only preceding draws.
 */
import {GAMES} from './core.js?v=18.0';
import {exactCoverage} from './evidence.js?v=18.0';
import {featuresOf,extraShape} from './shape-engine.js?v=18.0';

export const COMPOUND_TYPES={ssq:['8+1','7+4'],dlt:['7+2','5+7']};
export const validTemplate=(game,type)=>!!COMPOUND_TYPES[game]?.includes(type);
export const as2=n=>String(n).padStart(2,'0');
function enough(rows){return Array.isArray(rows)&&rows.length>=30}
export function ballFacts(rows,game,part){
 const g=GAMES[game];if(!g)throw Error('无效彩种');if(!['main','extra'].includes(part))throw Error('号码区错误');
 const max=part==='main'?g.mainMax:g.extraMax,k=part==='main'?g.mainCount:g.extraCount;
 if(!enough(rows))throw Error('需要至少30期历史开奖');
 const wins=[30,120,300],lens=Object.fromEntries(wins.map(w=>[w,Math.min(rows.length,w)]));
 return Array.from({length:max},(_,i)=>{
  const n=i+1;const counts=Object.fromEntries(wins.map(w=>[w,rows.slice(0,lens[w]).filter(d=>d[part].includes(n)).length]));
  const miss=rows.findIndex(d=>d[part].includes(n));
  const expected=Object.fromEntries(wins.map(w=>[w,lens[w]*k/max]));
  return {n,counts,miss:miss<0?rows.length:miss,observedLatest:rows[0][part].includes(n),expected};
 });
}

function chooseAdditional(rows,game,count,already){
 const facts=ballFacts(rows,game,'extra').filter(x=>!already.has(x.n));
 // Within equal coverage, include a mixture of high/middle/low frequencies rather than cherry-pick one regime.
 const byHot=[...facts].sort((a,b)=>b.counts[30]-a.counts[30]||b.counts[120]-a.counts[120]||a.n-b.n);
 const byCold=[...facts].sort((a,b)=>a.counts[30]-b.counts[30]||a.counts[120]-b.counts[120]||a.n-b.n);
 const byMiddle=[...facts].sort((a,b)=>Math.abs(a.counts[30]-a.expected[30])-Math.abs(b.counts[30]-b.expected[30])||a.n-b.n);
 const rankings=[byHot,byCold,byMiddle],selected=[],seen=new Set(already);
 for(let i=0;i<count;i++){let selectedFact=null;for(const x of rankings[i%3])if(!seen.has(x.n)){selectedFact=x;break}
  if(!selectedFact)throw Error('后区剩余可选号码不足');selected.push(selectedFact);seen.add(selectedFact.n);
 }
 return selected;
}
export function alternativeCompound(rows,game,primary){
 if(!GAMES[game]||primary?.game!==game||!enough(rows))throw Error('复式输入不合法');
 const type=COMPOUND_TYPES[game][1], [m,e]=type.split('+').map(Number),g=GAMES[game];
 const single=Array.isArray(primary.single)?primary.single:[...primary.main].slice(0,g.mainCount);
 if(single.length!==g.mainCount||!single.every(n=>primary.main.includes(n)))throw Error('旧复式没有包含对应单式，不能生成备选结构');
 const main=[...single];if(main.length<m)main.push(...primary.main.filter(n=>!main.includes(n)).slice(0,m-main.length));main.sort((a,b)=>a-b);
 const existing=new Set(primary.extra),added=chooseAdditional(rows,game,e-primary.extra.length,existing);
 const extra=[...existing,...added.map(x=>x.n)].sort((a,b)=>a-b);
 const actual=featuresOf(main,rows[0].main,game,rows[1]?.main||[]);
 const newEx=added.map(f=>({kind:'extra',number:f.n,observed:f.counts[120],expected:Number(f.expected[120].toFixed(2)),miss:f.miss,reason:`同预算增加后区覆盖：近30期${f.counts[30]}次，近120期${f.counts[120]}次，遗漏${f.miss}期。按高/低/中频交替选入，不意味着更可能开出。`}));
 const explanation=(primary.explain||[]).filter(x=>(x.kind==='main'&&main.includes(x.number))||(x.kind==='extra'&&extra.includes(x.number)));
 const x=exactCoverage(game,m,e);
 return {...primary,...x,main:main.sort((a,b)=>a-b),extra,type,origin:'同预算后区覆盖实验：保留同一研究员单式，新增号码采用高／低／中频交替观察策略。',explain:[...explanation,...newEx],single:[...single],shapeActual:actual,extraShape:extraShape(extra,game),pattern:{repeat:main.filter(n=>rows[0].main.includes(n)).length,adjacent:main.filter((n,i,a)=>i&&n===a[i-1]+1).length},snapshot:{...primary.snapshot,compound:true,mainCount:m,extraCount:e,seed:primary.snapshot.seed+'|alt-'+type}};
}
export function selectCompound(rows,game,primary,type){
 if(!validTemplate(game,type))throw Error('当前彩种不支持此复式结构');
 const defaultType=COMPOUND_TYPES[game][0];
 if(type===defaultType)return {...primary,type:defaultType,origin:primary.origin||'研究员原始复式候选'};
 return alternativeCompound(rows,game,primary);
}
export function validateCompound(game,p){
 const g=GAMES[game];if(!g||!p||p.game!==game)return false;
 const type=`${p.main?.length}+${p.extra?.length}`;if(!validTemplate(game,type))return false;
 const [m,e]=type.split('+').map(Number),x=exactCoverage(game,m,e);
 return new Set(p.main).size===m&&new Set(p.extra).size===e&&p.main.every(n=>Number.isInteger(n)&&n>=1&&n<=g.mainMax)&&p.extra.every(n=>Number.isInteger(n)&&n>=1&&n<=g.extraMax)&&x.bets===p.bets&&x.cost===p.cost;
}
export function rolling30(rows,game,part,periods=500,skip=0){
 const g=GAMES[game];const max=part==='main'?g.mainMax:g.extraMax,k=part==='main'?g.mainCount:g.extraCount;
 const chronological=[...rows].reverse();const last=Math.max(30,chronological.length-skip),first=Math.max(30,last-periods);
 let hotHits=0,coldHits=0,count=0;
 for(let i=first;i<last;i++){
  const past=chronological.slice(i-30,i),draw=chronological[i][part];
  const freq=Array.from({length:max},(_,j)=>({n:j+1,f:past.filter(x=>x[part].includes(j+1)).length}));
  const hot=[...freq].sort((a,b)=>b.f-a.f||a.n-b.n).slice(0,k),cold=[...freq].sort((a,b)=>a.f-b.f||a.n-b.n).slice(0,k);
  hotHits+=hot.filter(x=>draw.includes(x.n)).length;coldHits+=cold.filter(x=>draw.includes(x.n)).length;count++;
 }
 return {n:count,hotHits,coldHits,hotMean:count?hotHits/count:0,coldMean:count?coldHits/count:0,theory:k*k/max,window:30,part};
}
