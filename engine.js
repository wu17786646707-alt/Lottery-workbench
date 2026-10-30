/* 双彩工作台 V12 策略/回测统一内核：正式生成和历史回放调用同一 pick()。 */
import {GAMES,POLICY,hash,validBalls,numsText} from './core.js?v=12.2';
export function rngFrom(s){let seed=parseInt(hash(s),16)>>>0;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const stdev=a=>Math.sqrt(mean(a.map(v=>v*v))-mean(a)**2)||0;
const quant=(a,p)=>{const v=[...a].sort((x,y)=>x-y);if(!v.length)return 0;return v[Math.max(0,Math.min(v.length-1,Math.round((v.length-1)*p)))]};
export function stats(rows,kind,max){const freq=Array(max).fill(0),miss=Array(max).fill(rows.length),recent=Array(max).fill(0),prev=Array(max).fill(0),weighted=Array(max).fill(0),win=Math.min(20,rows.length);
 rows.forEach((row,i)=>{for(const n of row[kind]){freq[n-1]++;if(i<win)recent[n-1]++;else if(i<win*2)prev[n-1]++;if(miss[n-1]===rows.length)miss[n-1]=i;weighted[n-1]+=Math.exp(-i/12)}});
 return {freq,miss,recent,prev,weighted,n:rows.length,win,k:rows[0]?.[kind]?.length||0,max};
}
export function shape(nums,max){const a=[...nums].sort((x,y)=>x-y);return {sum:a.reduce((v,n)=>v+n,0),odd:a.filter(n=>n%2).length,span:a.at(-1)-a[0],adj:a.filter((n,i)=>i>0&&n-a[i-1]===1).length,zones:new Set(a.map(n=>Math.min(2,Math.floor((n-1)*3/max)))).size}}
function describeShape(a,rows,kind,max){const his=rows.map(d=>shape(d[kind],max)),f=shape(a,max);return {f,avg:{sum:mean(his.map(x=>x.sum)),odd:mean(his.map(x=>x.odd)),span:mean(his.map(x=>x.span))},sd:{sum:sd(his.map(x=>x.sum))||1,span:sd(his.map(x=>x.span))||1}}}
export function ballScore(s,n,mode){const i=n-1,expect=s.n*s.k/s.max,frequency=(s.freq[i]-expect)/Math.sqrt(Math.max(1,expect*(1-s.k/s.max))),momentum=(s.recent[i]-s.prev[i])/Math.sqrt(Math.max(1,s.win*s.k/s.max)),omission=s.miss[i]/Math.max(1,s.max/s.k),recency=s.weighted[i]/Math.max(1,s.k*12/s.max);
 if(mode==='trend')return 0.15*frequency+1.05*momentum+0.45*recency-0.20*Math.abs(omission-1);
 if(mode==='analyst')return 0.45*frequency+0.25*momentum+0.20*Math.min(omission,2.5)+0.10*recency;
 return 0.05*frequency;
}
function partScore(a,s,max,mode,reference){const f=shape(a,max),v=reference.avg,sd0=reference.sd;const sumZ=Math.abs(f.sum-v.sum)/sd0.sum,spanZ=Math.abs(f.span-v.span)/sd0.span;
 const ballComponent=mean(a.map(n=>ballScore(s,n,mode)));
 if(mode==='trend')return ballComponent*2-0.18*sumZ-0.12*spanZ;
 if(mode==='analyst')return 1.4*ballComponent-0.38*sumZ-0.17*spanZ-0.1*Math.abs(f.odd-v.odd);
 if(mode==='veteran')return (f.zones===3?0.8:0)-0.42*Math.abs(f.odd-a.length/2)-0.32*sumZ-0.23*spanZ+(f.adj<=1?0.25:-0.2)-0.06*Math.abs(ballComponent);
 return 0;
}
function shuffleChoice(max,k,rng,excluded){const pool=Array.from({length:max},(_,i)=>i+1).filter(n=>!excluded.has(n));if(pool.length<k)throw Error('杀号排除过多，剩余号码不足');for(let i=0;i<k;i++){const j=i+Math.floor(rng()*(pool.length-i));[pool[i],pool[j]]=[pool[j],pool[i]]}return pool.slice(0,k).sort((a,b)=>a-b)}
export function pick(rows,game,mode='analyst',config={}){const rule=GAMES[game];if(!rule)throw Error('彩种无效');if(!['analyst','veteran','trend','random'].includes(mode))throw Error('策略无效');if(rows.length<30)throw Error('有效历史数据不足30期');const size=Math.min(rows.length,Number(config.window)||60),history=rows.slice(0,size);const seed=String(config.seed||`${game}|${history[0].issue}|${mode}|${POLICY}|${size}`),r=rngFrom(seed),bans=config.bans||{},search=Math.max(1,Math.min(1400,Number(config.search)||450));
 const result={game,mode,main:[],extra:[],snapshot:{baseIssue:history[0].issue,window:size,policy:POLICY,seed,hash:hash(JSON.stringify(history.map(x=>[x.issue,x.date,x.main,x.extra]))),search},explain:[],score:{main:0,extra:0}};
 for(const [kind,max,k] of [['main',rule.mainMax,rule.mainCount],['extra',rule.extraMax,rule.extraCount]]){const excluded=new Set((bans[kind]||[]).map(Number)),s=stats(history,kind,max),reference=describeShape(history[0][kind],history,kind,max);let best=null,bestScore=-Infinity;
 for(let i=0;i<(mode==='random'?1:search);i++){const arr=shuffleChoice(max,k,r,excluded),score=partScore(arr,s,max,mode,reference);if(best===null||score>bestScore){best=arr;bestScore=score}}
 result[kind]=best;result.score[kind]=Number(bestScore.toFixed(3));
 result.explain.push(...best.map(n=>{const f=s.freq[n-1],expect=s.n*s.k/max,miss=s.miss[n-1],prev=s.prev[n-1],recent=s.recent[n-1];return {kind,number:n,observed:f,expected:Number(expect.toFixed(2)),miss,recent,previous:prev,reason:mode==='veteran'?'经验型结构组合：奇偶、区间、和值与跨度约束':mode==='trend'?`走势图短期${s.win}期出现${recent}次、前一窗口${prev}次，观察走势变化`:`近${s.n}期出现${f}次（均匀随机期望${expect.toFixed(1)}次），当前遗漏${miss}期`}}));
 }
 if(!validBalls(result.main,result.extra,game))throw Error('策略结果号码验证失败');return result;
}
export const scoreLabel={analyst:'数据研究员 A',veteran:'经验研究员 B',trend:'走势图独立选号 C',random:'随机基准'};
export function classifyKill(rows,game,method='cold',mainCount=5,extraCount=2){if(rows.length<30)throw Error('至少30期数据');if(!['cold','hot','miss'].includes(method))throw Error('杀号规则无效');const r=GAMES[game],out={game,method,baseIssue:rows[0].issue,window:rows.length,main:[],extra:[]};for(const [kind,max,k,count] of [['main',r.mainMax,r.mainCount,mainCount],['extra',r.extraMax,r.extraCount,extraCount]]){const st=stats(rows,kind,max),len=Math.max(0,Math.min(max-k,Number(count)||0)),order=Array.from({length:max},(_,i)=>i+1).sort((a,b)=>{let d=method==='miss'?st.miss[b-1]-st.miss[a-1]:method==='hot'?st.freq[b-1]-st.freq[a-1]:st.freq[a-1]-st.freq[b-1];return d||a-b});out[kind]=order.slice(0,len).map(n=>({number:n,frequency:st.freq[n-1],miss:st.miss[n-1],reason:method==='miss'?`当前遗漏${st.miss[n-1]}期，按最大遗漏排序`:method==='hot'?`近${rows.length}期出现${st.freq[n-1]}次，按高频排序`:`近${rows.length}期出现${st.freq[n-1]}次，按低频排序`}))}return out}
export const hit=(a,b)=>a.filter(n=>b.includes(n)).length;
export function nextDraw(rows,baseIssue){return [...rows].filter(x=>x.issue>baseIssue).sort((a,b)=>a.issue.localeCompare(b.issue))[0]||null}
function signPermutationP(diffs,seed,iterations=999){const abs=Math.abs(mean(diffs)),r=rngFrom(seed);if(!diffs.length)return 1;let ext=1;for(let i=0;i<iterations;i++){let x=0;for(const d of diffs)x+=d*(r()<.5?-1:1);if(Math.abs(x/diffs.length)>=abs-1e-12)ext++}return ext/(iterations+1)}
export function rollingBacktest(draws,game,config={}){const ordered=[...draws].sort((a,b)=>a.issue.localeCompare(b.issue)),train=Number(config.train)||60,test=Number(config.test)||60,modes=config.modes||['analyst','veteran','trend'];if(ordered.length<train+Math.min(test,20))throw Error(`至少需要${train+Math.min(test,20)}期历史数据`);
 const start=Math.max(train,ordered.length-test),series=[],byMode={},ensembleMain=[],ensembleExtra=[];for(const mode of [...modes,'random'])byMode[mode]={main:[],extra:[],total:[],kills:[],predictions:[]};
 for(let i=start;i<ordered.length;i++){const history=ordered.slice(0,i).slice(-train).reverse(),draw=ordered[i],row={issue:draw.issue,date:draw.date,draw,results:{}};
 for(const mode of [...modes,'random']){const result=pick(history,game,mode,{window:train,search:450}),main=hit(result.main,draw.main),extra=hit(result.extra,draw.extra);row.results[mode]={main,extra,total:main+extra,mainNumbers:result.main,extraNumbers:result.extra};byMode[mode].main.push(main);byMode[mode].extra.push(extra);byMode[mode].total.push(main+extra)}
 // 多次独立固定种子随机对照，降低单条随机基线偶然性；方法评分不变。
 let avgM=0,avgE=0;for(let rep=0;rep<24;rep++){const baseline=pick(history,game,'random',{window:train,seed:`${game}|${draw.issue}|reference-${rep}|${POLICY}`});avgM+=hit(baseline.main,draw.main);avgE+=hit(baseline.extra,draw.extra)}
 ensembleMain.push(avgM/24);ensembleExtra.push(avgE/24);row.randomEnsemble={main:avgM/24,extra:avgE/24};series.push(row);
 }
 const random=byMode.random,summary={},pValues=[];for(const mode of modes){const x=byMode[mode],mainDiff=x.main.map((v,i)=>v-ensembleMain[i]),extraDiff=x.extra.map((v,i)=>v-ensembleExtra[i]),totalDiff=x.total.map((v,i)=>v-ensembleMain[i]-ensembleExtra[i]);const sdev=stdev(totalDiff),n=totalDiff.length,delta=mean(totalDiff),margin=1.96*sdev/Math.sqrt(n);const p=signPermutationP(totalDiff,`${game}|${mode}|${ordered.at(-1)?.issue}|${train}|${test}`);
 summary[mode]={avgMain:mean(x.main),avgExtra:mean(x.extra),baseMain:mean(ensembleMain),baseExtra:mean(ensembleExtra),mainDiff:mean(mainDiff),extraDiff:mean(extraDiff),difference:delta,zExplore:sdev>0?delta/(sdev/Math.sqrt(n)):0,CI:[delta-margin,delta+margin],pExplore:p,adjustedP:Math.min(1,p*modes.length),periods:n,stability:[0,1,2].map(segment=>mean(totalDiff.slice(Math.floor(segment*n/3),Math.floor((segment+1)*n/3)))),confidence:'证据不足'};
 pValues.push({mode,p});}
 for(const mode of modes){const x=summary[mode],stable=x.stability.every(y=>y>0),positive=x.CI[0]>0,significant=x.adjustedP<.05;x.confidence=positive&&significant&&stable?'观察到探索性优势，尚待独立前瞻验证':'未验证出稳定优势';}
 return {game,train,test,actual:series.length,policy:POLICY,asOf:ordered.at(-1)?.issue,summary,series,disclaimer:'时间滚动回放，不含未来数据；随机对照每期采用24个独立固定种子，p值与置信区间均为探索性，采用保守多重比较校正。重复调参和回看可能使统计结论失真，不代表未来中奖概率提升。'};
}
export function evaluateKills(draws,game,config={}){const ordered=[...draws].sort((a,b)=>a.issue.localeCompare(b.issue)),train=Number(config.train)||60,test=Number(config.test)||60,method=config.method||'cold',nMain=Number(config.mainCount??5),nExtra=Number(config.extraCount??2);if(ordered.length<train+Math.min(test,20))throw Error('历史数据不足');let badMain=0,badExtra=0,randMain=0,randExtra=0,hitAll=0,items=[];
 for(let i=Math.max(train,ordered.length-test);i<ordered.length;i++){const past=ordered.slice(i-train,i).reverse(),draw=ordered[i],kill=classifyKill(past,game,method,nMain,nExtra),r=rngFrom(`${game}|${draw.issue}|kill-baseline`),rule=GAMES[game];const randomExclude=(max,k)=>{const a=Array.from({length:max},(_,j)=>j+1);for(let j=0;j<k;j++){const t=j+Math.floor(r()*(a.length-j));[a[j],a[t]]=[a[t],a[j]]}return a.slice(0,k)};const m=kill.main.map(x=>x.number),e=kill.extra.map(x=>x.number),kM=hit(m,draw.main),kE=hit(e,draw.extra);badMain+=kM;badExtra+=kE;randMain+=hit(randomExclude(rule.mainMax,m.length),draw.main);randExtra+=hit(randomExclude(rule.extraMax,e.length),draw.extra);if(kM+kE===0)hitAll++;items.push({issue:draw.issue,badMain:kM,badExtra:kE,randomMain:0,randomExtra:0})}
 const periods=items.length;return {game,method,train,periods,badMain,badExtra,randMain,randExtra,cleanPeriods:hitAll,randomExpectedMain:periods*nMain*GAMES[game].mainCount/GAMES[game].mainMax,randomExpectedExtra:periods*nExtra*GAMES[game].extraCount/GAMES[game].extraMax,items,disclaimer:'误杀=被排除号码实际开出；低误杀不自动代表未来有效。随机对照的误杀数亦有波动。'};
}
export function sensitivity(rows,game,mode='trend'){const sizes=[30,60,100].filter(n=>rows.length>=n),out=[];for(const n of sizes){const p=pick(rows,game,mode,{window:n});out.push({window:n,main:p.main,extra:p.extra})}return out}
export function summarizePred(p,rows){const r=GAMES[p.game],mainShape=shape(p.main,r.mainMax),history=rows.slice(0,p.snapshot.window);const st=stats(history,'main',r.mainMax);return {features:mainShape,text:`${scoreLabel[p.mode]}：基于${p.snapshot.window}期、最新${p.snapshot.baseIssue}期；主区和值${mainShape.sum}、奇数${mainShape.odd}个、连号对${mainShape.adj}；主区平均近窗出现${mean(p.main.map(n=>st.freq[n-1])).toFixed(2)}次。${p.mode==='trend'?'独立依据短窗与前窗频次差生成，并不意味下一期有趋势延续。':p.mode==='veteran'?'用经验型组合约束选择，并无已证实优势。':'以频率、遗漏与形态共同评分。'}数据特征不代表中奖概率提升。`}}
