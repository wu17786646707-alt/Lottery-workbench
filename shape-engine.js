/**
 * V16 Shape-first research layer (not a probability predictor).
 * This is a scoring/description component only; never hard-excludes by default.
 * Data must be newest-first and every row is historical as of decision time.
 */
import {GAMES} from './core.js?v=16.0';
export const SHAPE_POLICY='shape-first-v16.0';
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const round=(v,p=2)=>Number(v.toFixed(p));
const quant=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(p*(b.length-1))]||0};
export const zonesFor=(game,n)=>game==='ssq'?(n<=11?0:n<=22?1:2):(n<=12?0:n<=24?1:2);
export const largeFor=(game,n)=>n>(game==='ssq'?16:17);
export function featuresOf(nums,previous=[],game='ssq',previous2=[]){
 const x=[...nums].sort((a,b)=>a-b),p=new Set(previous),pp=new Set(previous2),zone=[0,0,0];x.forEach(n=>zone[zonesFor(game,n)]++);
 const odd=x.filter(n=>n%2).length,large=x.filter(n=>largeFor(game,n)).length;
 const repeat=x.filter(n=>p.has(n)).length,adj=x.filter((n,i)=>i>0&&n===x[i-1]+1).length;
 // Inter-period diagonal: a number is +/-1 away from an earlier draw number.
 const neighbor=x.filter(n=>p.has(n-1)||p.has(n+1)).length;
 // A three-draw diagonal means prev ±1 and prev-prev ±2, same direction.
 const diagonal=x.filter(n=>(p.has(n-1)&&pp.has(n-2))||(p.has(n+1)&&pp.has(n+2))).length;
 return {head:x[0],tail:x.at(-1),zones:zone,odd,large,sum:x.reduce((a,b)=>a+b,0),span:x.at(-1)-x[0],repeat,adj,neighbor,diagonal};
}
function choose(n,k){if(k>n)return 0;let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v}
function histTop(items,limit=4){const m=new Map();items.forEach(x=>m.set(x,(m.get(x)||0)+1));return [...m].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]))).slice(0,limit).map(([value,n])=>({value,n,frequency:round(n/items.length,3)}))}
export function shapePlan(rows,game,mode='veteran',nOverride){
 const g=GAMES[game];if(!g||!rows||rows.length<30)throw Error('形态研究需要至少31期有效历史数据');
 const n=nOverride||g.mainCount,sample=Math.min(300,rows.length-1),data=[];
 for(let i=0;i<sample;i++)data.push(featuresOf(rows[i].main,rows[i+1].main,game,rows[i+2]?.main||[]));
 const common=histTop(data.map(x=>x.zones.join(':')),5),odd=histTop(data.map(x=>x.odd),4),large=histTop(data.map(x=>x.large),4),repeat=histTop(data.map(x=>x.repeat),4),adj=histTop(data.map(x=>x.adj),4);
 const index=mode==='veteran'?0:mode==='analyst'?1:mode==='trend'?2:3;
 const template=common[Math.min(index,common.length-1)]?.value||common[0].value;
 const original=template.split(':').map(Number);let zones=original;
 if(n!==g.mainCount){const raw=original.map(v=>v*n/g.mainCount),base=raw.map(Math.floor);let need=n-base.reduce((a,b)=>a+b,0);const positions=[0,1,2].sort((a,b)=>(raw[b]-base[b])-(raw[a]-base[a]));for(let i=0;i<need;i++)base[positions[i%3]]++;zones=base;}
 const scale=n/g.mainCount,head=[quant(data.map(x=>x.head),.10),quant(data.map(x=>x.head),.90)],tail=[quant(data.map(x=>x.tail),.10),quant(data.map(x=>x.tail),.90)];
 const getBand=key=>[quant(data.map(x=>x[key]),.1),quant(data.map(x=>x[key]),.9)];
 const target={zones,odd:Math.round(Number(odd[0].value)*scale),large:Math.round(Number(large[0].value)*scale),repeat:Math.round(Number(repeat[0].value)*scale),adj:Math.round(Number(adj[0].value)*scale),headBand:head,tailBand:tail,sumBand:getBand('sum').map(x=>Math.round(x*scale)),spanBand:getBand('span'),neighbor:avg(data.map(x=>x.neighbor)),diagonal:avg(data.map(x=>x.diagonal))};
 const empirical={sample,commonZones:common,odd,large,repeat,adj,head10to90:head,tail10to90:tail,sum10to90:getBand('sum'),span10to90:getBand('span'),neighborAverage:round(target.neighbor),diagonalAverage:round(target.diagonal)};
 const rule=`${mode==='veteran'?'经验型优先考虑常见分区结构':mode==='analyst'?'数据型关注第二组高频形态并兼顾号码得分':mode==='trend'?'走势型保留第三组形态进行差异研究':'随机基准不限制形态'}；目标三区${zones.join(':')}，龙头观察${head.join('～')}，凤尾观察${tail.join('～')}；全部是历史偏好，不是中奖概率。`;
 return {game,mode,target,empirical,reason:rule};
}
export function shapePenalty(numbers,prev,game,plan,prev2=[]){
 const f=featuresOf(numbers,prev,game,prev2),t=plan.target,
 distance=(x,r)=>x<r[0]?r[0]-x:x>r[1]?x-r[1]:0;
 // Soft constraints deliberately retain possible unusual results.
 const p= .42*f.zones.reduce((s,v,i)=>s+Math.abs(v-t.zones[i]),0)
 +.12*Math.abs(f.odd-t.odd)+.12*Math.abs(f.large-t.large)
 +.08*Math.abs(f.repeat-t.repeat)+.10*Math.abs(f.adj-t.adj)
 +.15*distance(f.head,t.headBand)+.10*distance(f.tail,t.tailBand)
 +.018*distance(f.sum,t.sumBand)+.07*distance(f.span,t.spanBand)
 +.025*Math.abs(f.neighbor-t.neighbor)+.025*Math.abs(f.diagonal-t.diagonal);
 return {penalty:round(p,4),actual:f};
}
export function softKill(rows,game,part='main',count=4){
 if(!rows||rows.length<30)throw Error('至少30期数据');const g=GAMES[game],max=part==='main'?g.mainMax:g.extraMax,k=part==='main'?g.mainCount:g.extraCount;
 const w=Math.min(60,rows.length),recent=rows.slice(0,w),expected=w*k/max;const candidates=[];
 for(let n=1;n<=max;n++){
  const frequency=recent.filter(r=>r[part].includes(n)).length,miss=rows.findIndex(r=>r[part].includes(n));
  // An explicit experimental priority; no assertion of lower actual draw chance.
  const score=frequency/Math.max(.1,expected)-.12*Math.min(5,(miss===-1?rows.length:miss)/(max/k));
  candidates.push({number:n,observed:frequency,expected:round(expected),miss:miss===-1?rows.length:miss,priority:round(score,3),reason:`近${w}期出现${frequency}次，理论均值${expected.toFixed(1)}次，当前遗漏${miss===-1?rows.length:miss}期；仅列为低优先级，不硬排除。`});
 }
 return candidates.sort((a,b)=>a.priority-b.priority||a.number-b.number).slice(0,Math.max(0,Math.min(max-k,Math.floor(count))));
}
export function exclusionRisk(game,part,count){const g=GAMES[game],N=part==='main'?g.mainMax:g.extraMax,k=part==='main'?g.mainCount:g.extraCount;const m=Math.max(0,Math.min(N-k,Math.floor(count)));
 return {excluded:m,clean:round(choose(N-m,k)/choose(N,k),6),anyHit:round(1-choose(N-m,k)/choose(N,k),6),note:'仅为公平随机下固定硬杀号误杀概率，不代表软杀号会有同等损失'};
}
export function extraShape(nums,game){const g=GAMES[game],x=[...nums].sort((a,b)=>a-b),large=x.filter(n=>n>g.extraMax/2).length,odd=x.filter(n=>n%2).length;return {odd,even:x.length-odd,large,small:x.length-large,sum:x.reduce((a,b)=>a+b,0),gap:x.length===2?x[1]-x[0]:null};}
export function extraShapePenalty(nums,game,mode='veteran'){
 const f=extraShape(nums,game);if(game==='ssq')return {penalty:0,actual:f,reason:'双色球蓝球为单个号码，无两球奇偶/大小组合可推断'};
 // More common classes contain more combinations, but any specific pair is equiprobable.
 const penalty=(mode==='veteran'?.25:.08)*(Math.abs(f.odd-1)+Math.abs(f.large-1))+.025*Math.abs(f.gap-4);
 return {penalty:round(penalty,4),actual:f,reason:'大乐透后区奇偶、大小和两号码间距只描述组合形态，不意味着单对号码更可能开奖'};
}
