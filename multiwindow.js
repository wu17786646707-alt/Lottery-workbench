/**
 * V15 independent multi-window researcher engine.
 * All heuristics are exploratory scores, NOT calibrated draw probabilities.
 * Draws must be supplied in newest-first order; backtests use only past draws.
 */
import {GAMES,hash} from './core.js?v=17.2';
import {shapePlan,shapePenalty,softKill,extraShapePenalty,extraShape,SHAPE_POLICY} from './shape-engine.js?v=17.2';

export const MW_POLICY='research-v17.0-shape-first';
export const WINDOWS=[20,60,120,300];
export const MODES=['analyst','veteran','trend','random'];
export const MODE_LABELS={analyst:'A 数据研究员',veteran:'B 经验研究员',trend:'C 走势研究员',random:'随机基准'};
export const maxInt=(x,a,b)=>Math.max(a,Math.min(b,x));
const round=(x,n=3)=>Number(x.toFixed(n));
const avg=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
const std=x=>{const m=avg(x);return Math.sqrt(avg(x.map(v=>(v-m)**2)))};
function rng(seed){let v=parseInt(hash(seed),16)>>>0;return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296}}
function choose(n,k){let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return Math.round(v)}
function validateRows(rows,game){
 if(!GAMES[game])throw Error('彩种未知');
 if(!Array.isArray(rows)||rows.length<30)throw Error('多窗口研究至少需要30期真实历史开奖数据');
 const rule=GAMES[game];
 for(const x of rows.slice(0,Math.min(300,rows.length))){
  for(const [part,k,max] of [['main',rule.mainCount,rule.mainMax],['extra',rule.extraCount,rule.extraMax]]){
   if(!Array.isArray(x?.[part])||x[part].length!==k||new Set(x[part]).size!==k||x[part].some(v=>!Number.isInteger(v)||v<1||v>max))throw Error('历史数据包含不合法号码，拒绝研究');
  }
 }
}
export function factTable(rows,game,part){
 validateRows(rows,game);
 const g=GAMES[game],max=part==='main'?g.mainMax:g.extraMax,k=part==='main'?g.mainCount:g.extraCount;
 const recent=rows[0],features=[];
 for(let n=1;n<=max;n++){
  const counts={},lengths={};
  for(const w of WINDOWS){const section=rows.slice(0,w);counts[w]=section.filter(r=>r[part].includes(n)).length;lengths[w]=section.length}
  counts.all=rows.filter(r=>r[part].includes(n)).length;lengths.all=rows.length;
  const find=rows.findIndex(r=>r[part].includes(n));const miss=find<0?rows.length:find;
  const f=counts[120],len=lengths[120],p=k/max,ex=len*p,z=(f-ex)/Math.sqrt(Math.max(.1,len*p*(1-p)));
  const trend={},zTrend={};
  for(const w of [10,20,40]){
   const a=rows.slice(0,w),b=rows.slice(w,2*w);
   const ra=a.length?a.filter(r=>r[part].includes(n)).length/a.length:0;
   const rb=b.length?b.filter(r=>r[part].includes(n)).length/b.length:0;
   trend[w]=round(ra-rb,4);
   zTrend[w]=round((ra-rb)/Math.sqrt(Math.max(.001,p*(1-p)*(1/Math.max(1,a.length)+1/Math.max(1,b.length)))),3);
  }
  features.push({n,counts,lengths,miss,latest:recent[part].includes(n),expected:round(ex,2),z:round(z,3),trend,zTrend});
 }
 return {game,part,latestIssue:recent.issue,latestDate:recent.date,total:rows.length,max,k,rows:features};
}
export function patterns(rows,game,window=300){
 validateRows(rows,game);
 const slice=rows.slice(0,Math.max(20,Math.min(window,rows.length-1)));const data=[];
 for(let i=0;i<slice.length;i++){
  const main=[...slice[i].main].sort((a,b)=>a-b),last=new Set(rows[i+1]?.main||[]);
  const repeat=main.filter(n=>last.has(n)).length,adj=main.filter((n,j)=>j>0&&n===main[j-1]+1).length;
  data.push({sum:main.reduce((x,y)=>x+y,0),odd:main.filter(n=>n%2).length,span:main.at(-1)-main[0],repeat,adj});
 }
 return {sample:data.length,sum:round(avg(data.map(x=>x.sum))),odd:round(avg(data.map(x=>x.odd))),span:round(avg(data.map(x=>x.span))),repeat:round(avg(data.map(x=>x.repeat))),adj:round(avg(data.map(x=>x.adj))),sumSD:Math.max(3,std(data.map(x=>x.sum))),spanSD:Math.max(2,std(data.map(x=>x.span)))};
}
function scoreFeature(f,mode,game,part,primary=120){
 const cfg=GAMES[game],p=part==='main'?cfg.mainCount/cfg.mainMax:cfg.extraCount/cfg.extraMax;
 const zWindow=w=>{
  const n=f.lengths[w],ex=n*p;
  return maxInt((f.counts[w]-ex)/Math.sqrt(Math.max(.1,n*p*(1-p))),-2.5,2.5)*n/(n+80);
 };
 const trend= maxInt(.30*f.zTrend[10]+.40*f.zTrend[20]+.30*f.zTrend[40],-2,2);
 const omiss=maxInt((f.miss-(1/p-1))/(1/p),-2,2);
 if(mode==='analyst')return .19*zWindow(120)+.16*zWindow(300)+.16*zWindow(60)+.21*zWindow(primary)+.17*trend+.11*omiss;
 if(mode==='trend')return .75*trend+.13*zWindow(primary)+.08*zWindow(120)+.04*zWindow(300);
 if(mode==='veteran')return .03*zWindow(120); // B is predominantly a STRUCTURAL experiment.
 return 0;
}
function shuffle(max,k,random,excluded=new Set()){
 const a=Array.from({length:max},(_,i)=>i+1).filter(n=>!excluded.has(n));
 if(a.length<k)throw Error('杀号过多，剩余号码不足');
 for(let i=0;i<k;i++){const j=i+Math.floor(random()*(a.length-i));[a[i],a[j]]=[a[j],a[i]]}
 return a.slice(0,k).sort((a,b)=>a-b);
}
function structureScore(nums,last,profile,mode,baseK){
 const n=nums.length,rep=nums.filter(v=>last.includes(v)).length;
 const adj=nums.filter((v,i)=>i>0&&nums[i-1]+1===v).length;
 const sum=nums.reduce((a,b)=>a+b,0),odd=nums.filter(x=>x%2).length,span=nums.at(-1)-nums[0];
 const scale=n/baseK,expectRep=profile.repeat*scale,expectAdj=profile.adj*(n*(n-1))/(baseK*(baseK-1));
 const structural=.25*Math.abs(sum-profile.sum*scale)/(profile.sumSD*scale)+.19*Math.abs(span-profile.span)/(profile.spanSD)+.18*Math.abs(odd-n/2)+.15*Math.abs(rep-expectRep)+.13*Math.abs(adj-expectAdj);
 return {penalty:structural*(mode==='veteran'?1.4:mode==='trend'?.32:.48),rep,adj,sum,odd,span};
}
function pickPart(rows,game,mode,part,size,seed,banned,search,primary){
 const g=GAMES[game],max=part==='main'?g.mainMax:g.extraMax,baseK=part==='main'?g.mainCount:g.extraCount;
 const f=factTable(rows,game,part),features=f.rows.map(x=>({...x,score:scoreFeature(x,mode,game,part,primary)}));
 const random=rng(seed+'|'+part),profile=part==='main'?patterns(rows,game,300):null,plan=part==='main'?shapePlan(rows,game,mode,size):null;
 const lowered=mode==='random'?new Set():new Set(softKill(rows,game,part,part==='main'?4:1).map(x=>x.number));
 let best=null,bestScore=-Infinity;
 const runs=mode==='random'?1:search;
 for(let t=0;t<runs;t++){
  const nums=shuffle(max,size,random,banned),mean=avg(nums.map(n=>features[n-1].score));
  const penalty=profile?structureScore(nums,[...rows[0].main],profile,mode,baseK).penalty:0;
  let val=mode==='veteran'?mean*.15-penalty:mode==='trend'?mean*2.0-penalty:mean*1.5-penalty;
  if(mode!=='random'){const shp=plan?shapePenalty(nums,rows[0].main,game,plan,rows[1]?.main||[]):extraShapePenalty(nums,game,mode);val-= (mode==='veteran'?.70:mode==='trend'?.42:.32)*shp.penalty;val-=nums.filter(n=>lowered.has(n)).length*.067;}
  if(best===null||val>bestScore){best=nums;bestScore=val}
 }
 return {numbers:best,score:round(bestScore),features,shapePlan:plan,softKills:[...lowered]};
}
function explanation(part,nums,features,mode,rows){return nums.map(n=>{
 const x=features[n-1],w=120,count=x.counts[120],len=x.lengths[120];
 const info=`近20期${x.counts[20]}次，60期${x.counts[60]}次，120期${count}次（随机理论约${x.expected}次），300期${x.counts[300]}次，全历史${x.counts.all}次；当前遗漏${x.miss}期`;
 const note=mode==='analyst'?'综合长短窗的标准化频率与遗漏分数，且对小样本波动做收缩':mode==='trend'?'对比10/20/40期前后窗口频率变化，未假设趋势必然持续':mode==='veteran'?'按和值、奇偶、重号、连号等经验结构筛选；这是偏好而非概率优势':'等概率随机抽取';
 return {kind:part,number:n,observed:count,expected:x.expected,miss:x.miss,recent:x.counts[20],previous:Math.max(0,x.counts[60]-x.counts[20]),reason:`${info}。${note}。研究分${round(x.score)}，并非下一期开奖概率。`,score:round(x.score),counts:x.counts,trend:x.trend};
 });}
export function pickV15(rows,game,mode='analyst',config={}){
 validateRows(rows,game);
 if(!MODES.includes(mode))throw Error('不支持的研究员');
 const g=GAMES[game],baseWindow=Math.min(rows.length,Math.max(30,Number(config.window)||120)),mainCount=config.mainCount=== (game==='ssq'?8:7) ?(game==='ssq'?8:7):g.mainCount,extraCount=g.extraCount;
 const banned={main:new Set((config.bans?.main||[]).map(Number)),extra:new Set((config.bans?.extra||[]).map(Number))};
 const primaryWindow=[60,120,300].includes(baseWindow)?baseWindow:120;
 const seed=String(config.seed||`${game}|${rows[0].issue}|${mode}|${MW_POLICY}|${mainCount}|${baseWindow}`);
 const search=maxInt(Number(config.search)||360,1,900);
 const a=pickPart(rows,game,mode,'main',mainCount,seed,banned.main,search,primaryWindow),b=pickPart(rows,game,mode,'extra',extraCount,seed,banned.extra,search,primaryWindow);
 const main=a.numbers,extra=b.numbers;
 const patt={repeat:main.filter(n=>rows[0].main.includes(n)).length,adjacent:main.filter((n,i)=>i>0&&n===main[i-1]+1).length};
 const dataHash=hash(JSON.stringify(rows.slice(0,baseWindow).map(x=>[x.issue,x.date,x.main,x.extra])));
 const bets=choose(mainCount,g.mainCount)*choose(extraCount,g.extraCount);
 const res={game,mode,main,extra,pattern:patt,score:{main:a.score,extra:b.score},shapePlan:a.shapePlan,shapeActual:a.shapePlan?shapePenalty(main,rows[0].main,game,a.shapePlan,rows[1]?.main||[]).actual:null,extraShape:extraShape(extra,game),softKills:{main:a.softKills,extra:b.softKills},
  snapshot:{baseIssue:rows[0].issue,window:baseWindow,policy:MW_POLICY,seed,hash:dataHash,search,mainCount,compound:bets>1},
  explain:[...explanation('main',main,a.features,mode,rows),...explanation('extra',extra,b.features,mode,rows)],
  bets,cost:bets*2,additionalCost:game==='dlt'?bets*3:null};
 const s=`${MODE_LABELS[mode]}：对照20/60/120/300期（数据不足时使用现有期数），参考10/20/40期短窗变化；本注重号${patt.repeat}个、连号${patt.adjacent}对，主区研究评分${a.score}。评分只描述规则优先级，不是开出概率。`;
 res.summ={text:s,features:{repeat:patt.repeat,adjacent:patt.adjacent}};
 return res;
}
export function makeCompoundV15(rows,game,mode='trend',config={}){
 // Compound includes the same mode's single ticket for a consistent researcher report.
 const p=pickV15(rows,game,mode,{...config,mainCount:undefined});
 const g=GAMES[game],required=game==='ssq'?8:7;
 const scores=factTable(rows,game,'main').rows.map(f=>({n:f.n,score:scoreFeature(f,mode,game,'main',p.snapshot.window)}));
 const chosen=new Set(p.main),exclude=new Set((config.bans?.main||[]).map(Number));
 const remaining=scores.filter(x=>!chosen.has(x.n)&&!exclude.has(x.n));
 remaining.sort((a,b)=>b.score-a.score||a.n-b.n);
 for(let step=chosen.size;step<required;step++){
  const plan=shapePlan(rows,game,mode,step+1),options=remaining.filter(r=>!chosen.has(r.n));
  if(!options.length)break;
  const rank=options.map(r=>{const tentative=[...chosen,r.n].sort((a,b)=>a-b),pen=shapePenalty(tentative,rows[0].main,game,plan,rows[1]?.main||[]).penalty;
   return {n:r.n,val:r.score-(mode==='veteran'?.75:.36)*pen};
  }).sort((a,b)=>b.val-a.val||a.n-b.n);chosen.add(rank[0].n);
 }
 if(chosen.size!==required)throw Error('剩余候选不足，无法形成复式');
 const main=[...chosen].sort((a,b)=>a-b),bets=choose(required,g.mainCount),facts=factTable(rows,game,'main').rows;
 const ex=[...p.explain,...explanation('main',main.filter(n=>!p.main.includes(n)),facts.map(f=>({...f,score:scoreFeature(f,mode,game,'main',p.snapshot.window)})),mode,rows)];
 return {...p,main,explain:ex,shapePlan:shapePlan(rows,game,mode,required),shapeActual:shapePenalty(main,rows[0].main,game,shapePlan(rows,game,mode,required),rows[1]?.main||[]).actual,pattern:{repeat:main.filter(n=>rows[0].main.includes(n)).length,adjacent:main.filter((n,i)=>i>0&&n===main[i-1]+1).length},bets,cost:2*bets,additionalCost:game==='dlt'?3*bets:null,
   snapshot:{...p.snapshot,mainCount:required,compound:true,seed:p.snapshot.seed+'|extension'},single:p.main};
}
export function backtestV15(draws,game,opts={}){
 validateRows(draws,game);
 const train=maxInt(Number(opts.train)||300,300,800),test=maxInt(Number(opts.test)||40,5,120);
 const chron=[...draws].sort((a,b)=>a.issue.localeCompare(b.issue)),start=Math.max(train,chron.length-test);
 if(chron.length<train+5)throw Error(`历史期数不足，需要至少${train+5}期`);
 const g=GAMES[game],byMode={},series=[],raw={};
 for(const mode of MODES)raw[mode]=[];
 for(let i=start;i<chron.length;i++){
  const history=chron.slice(i-train,i).reverse(),actual=chron[i],one={issue:actual.issue,date:actual.date,results:{}};
  for(const mode of MODES){const ticket=pickV15(history,game,mode,{window:Number(opts.window)||120,search:360});
   const main=ticket.main.filter(n=>actual.main.includes(n)).length,extra=ticket.extra.filter(n=>actual.extra.includes(n)).length;
   raw[mode].push({main,extra,total:main+extra});one.results[mode]={main,extra,mainNumbers:ticket.main,extraNumbers:ticket.extra};
  }
  series.push(one);
 }
 const n=series.length,expectedMain=g.mainCount*g.mainCount/g.mainMax,expectedExtra=g.extraCount*g.extraCount/g.extraMax;
 for(const mode of MODES.filter(x=>x!=='random')){
  const hits=raw[mode],baseline=raw.random,delta=hits.map(x=>x.total-expectedMain-expectedExtra),d=avg(delta),se=std(delta)/Math.sqrt(n);
  const stab=[0,1,2].map(j=>avg(delta.slice(Math.floor(j*n/3),Math.floor((j+1)*n/3))));
  byMode[mode]={avgMain:avg(hits.map(x=>x.main)),avgExtra:avg(hits.map(x=>x.extra)),baseMain:expectedMain,baseExtra:expectedExtra,observedRandomMain:avg(baseline.map(x=>x.main)),observedRandomExtra:avg(baseline.map(x=>x.extra)),
   difference:d,CI:[d-1.96*se,d+1.96*se],zExplore:se?d/se:0,adjustedP:null,stability:stab,
   confidence:'未完成预注册前瞻验证；历史结果仅作探索，禁止宣称策略优势',periods:n,
   theoreticalMain:expectedMain,theoreticalExtra:expectedExtra};
 }
 return {game,train,test,actual:n,asOf:chron.at(-1)?.issue,policy:MW_POLICY,summary:byMode,series,
  disclaimer:'V15正式选号与本回测使用相同多窗口策略；按时间顺序只使用开奖前已有历史。随机单式实测作为参考，同时使用精确的公平随机理论期望作为主要基线，以减少单条随机号码的偶然性。95%区间为探索性近似；未开展预注册显著性检验。历史调参可能过拟合，未发现经独立前瞻验证的中奖概率优势。'};
}

export function rollingCompoundBacktestV15(draws,game,mode='trend',opts={}){
 validateRows(draws,game);const train=maxInt(Number(opts.train)||300,300,800),test=maxInt(Number(opts.test)||20,5,70);
 const chron=[...draws].sort((a,b)=>a.issue.localeCompare(b.issue));if(chron.length<train+5)throw Error('至少需要训练窗口+5期历史数据');
 const items=[];for(let i=Math.max(train,chron.length-test);i<chron.length;i++){
  const history=chron.slice(i-train,i).reverse(),draw=chron[i],p=makeCompoundV15(history,game,mode,{window:Number(opts.window)||120});
  items.push({issue:draw.issue,date:draw.date,main:p.main.filter(n=>draw.main.includes(n)).length,extra:p.extra.filter(n=>draw.extra.includes(n)).length,bets:p.bets});
 }
 const rule=GAMES[game],ms=game==='ssq'?8:7;
 return {game,mode,train,periods:items.length,items,averages:{main:avg(items.map(x=>x.main)),extra:avg(items.map(x=>x.extra))},
  randomExpected:{main:ms*rule.mainCount/rule.mainMax,extra:rule.extraCount*rule.extraCount/rule.extraMax},
  disclaimer:'V15复式正式生成与回测调用同一算法；时间滚动且只使用当期以前数据。研究组合和等量随机复式在公平开奖下具有相同一等奖概率。'};
}
