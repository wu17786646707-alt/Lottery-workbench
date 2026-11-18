/* Lottery Workbench V18.7: public, deterministic research utilities. No forecasting guarantees. */
(function(root){'use strict';
 const G={ssq:{name:'双色球',mainMax:33,extraMax:16,mainCount:6,extraCount:1,selectMain:7,selectExtra:4,normalMain:8,normalExtra:1,poolMain:14,poolExtra:5},dlt:{name:'超级大乐透',mainMax:35,extraMax:12,mainCount:5,extraCount:2,selectMain:5,selectExtra:7,normalMain:7,normalExtra:2,poolMain:13,poolExtra:5}};
 const choose=(n,k)=>{if(k<0||k>n)return 0;let s=1;for(let i=1;i<=k;i++)s=s*(n-i+1)/i;return Math.round(s)};
 const sorted=(a)=>[...a].map(Number).sort((x,y)=>x-y);
 function validRows(game,input){const c=G[game];if(!c)throw Error('彩种错误');let rows=(Array.isArray(input)?input:[]).filter(x=>x&&/^\d{7}$/.test(String(x.issue))&&/^20\d{2}-\d\d-\d\d$/.test(String(x.date))&&Array.isArray(x.main)&&Array.isArray(x.extra)&&x.main.length===c.mainCount&&x.extra.length===c.extraCount&&new Set(x.main).size===c.mainCount&&new Set(x.extra).size===c.extraCount&&x.main.every(v=>Number.isInteger(v)&&v>0&&v<=c.mainMax)&&x.extra.every(v=>Number.isInteger(v)&&v>0&&v<=c.extraMax));rows.sort((a,b)=>b.issue.localeCompare(a.issue));return rows.filter((v,i)=>i===0||v.issue!==rows[i-1].issue)}
 function frequency(rows,part,max,w){let out=Array(max+1).fill(0);for(const r of rows.slice(0,Math.min(w,rows.length)))for(const n of r[part])out[n]++;return out}
 function softKill(rows,game,part='main',howMany=4){const c=G[game],N=part==='main'?c.mainMax:c.extraMax,k=part==='main'?c.mainCount:c.extraCount;if(rows.length<30)throw Error('至少需要30期');const w=Math.min(60,rows.length),counts=frequency(rows,part,N,w),expected=w*k/N;return Array.from({length:N},(_,i)=>i+1).map(n=>{let j=rows.findIndex(x=>x[part].includes(n)),miss=j===-1?rows.length:j;return {n,score:counts[n]/Math.max(.1,expected)-.12*Math.min(5,miss/(N/k)),count:counts[n],miss}}).sort((a,b)=>a.score-b.score||a.n-b.n).slice(0,Math.min(howMany,N-k)).map(x=>x.n)}
 function rated(rows,game,part='main',mode='multi'){const c=G[game],max=part==='main'?c.mainMax:c.extraMax,k=part==='main'?c.mainCount:c.extraCount;if(rows.length<120)throw Error('历史期数不足120期');let c10=frequency(rows,part,max,10),c30=frequency(rows,part,max,30),c60=frequency(rows,part,max,60),c120=frequency(rows,part,max,120),killed=new Set(softKill(rows,game,part,part==='main'?4:1));const Z=(arr,n,w)=>(arr[n]-w*k/max)/Math.max(.5,Math.sqrt(w*k/max*(1-k/max)));
 return Array.from({length:max},(_,i)=>i+1).map(n=>{let score;
 if(mode==='hot') score=.75*Z(c30,n,30)+.25*Z(c60,n,60);
 else if(mode==='cold')score=-.7*Z(c30,n,30)-.3*Z(c60,n,60);
 else if(mode==='turn')score=.65*(Z(c10,n,10)-Z(c60,n,60))+.35*Z(c30,n,30);
 else score=.4*Z(c30,n,30)+.27*Z(c60,n,60)+.2*Z(c120,n,120)+.13*Z(c10,n,10);
 // softKill is a small *penalty*; it is NEVER a hard veto.
 if(killed.has(n))score-=.15;
 return {n,score,short:c30[n],long:c120[n],softKilled:killed.has(n)};
 }).sort((a,b)=>b.score-a.score||a.n-b.n)}
 function deterministicRandom(seed){let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)}return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return(h>>>0)/4294967296}}
 function build(rows,game,mode='multi'){const c=G[game],m=rated(rows,game,'main',mode),e=rated(rows,game,'extra',mode);let main,extra;
 if(mode==='random'){const rng=deterministicRandom(game+'|'+rows[0].issue+'|V18.7|control');function rselect(max,k){let a=Array.from({length:max},(_,i)=>i+1);for(let i=0;i<k;i++){let j=i+Math.floor(rng()*(max-i));[a[i],a[j]]=[a[j],a[i]]}return sorted(a.slice(0,k))}main=rselect(c.mainMax,c.selectMain);extra=rselect(c.extraMax,c.selectExtra)}
 else {main=sorted(m.slice(0,c.selectMain).map(x=>x.n));extra=sorted(e.slice(0,c.selectExtra).map(x=>x.n))}
 return {game,mode,baseIssue:rows[0].issue,main,extra,kills:{main:softKill(rows,game,'main',4),extra:softKill(rows,game,'extra',1)},explain:'只使用已开奖的10/30/60/120期频率，软杀号减分而非禁止；分数不是开奖概率。'} }
 function validSelection(game,main,extra){let c=G[game];if(!c||!Array.isArray(main)||!Array.isArray(extra)||main.length!==c.selectMain||extra.length!==c.selectExtra)return false;return new Set(main).size===main.length&&new Set(extra).size===extra.length&&main.every(n=>Number.isInteger(n)&&n>=1&&n<=c.mainMax)&&extra.every(n=>Number.isInteger(n)&&n>=1&&n<=c.extraMax)}
 function exact(game,m,e){const c=G[game];if(!c||m<c.mainCount||m>c.mainMax||e<c.extraCount||e>c.extraMax)throw Error('非法复式');let total=choose(c.mainMax,c.mainCount)*choose(c.extraMax,c.extraCount),n=choose(m,c.mainCount)*choose(e,c.extraCount),win=0;
 for(let hitMain=0;hitMain<=c.mainCount;hitMain++)for(let hitExtra=0;hitExtra<=c.extraCount;hitExtra++){
  let copies=choose(m,hitMain)*choose(c.mainMax-m,c.mainCount-hitMain)*choose(e,hitExtra)*choose(c.extraMax-e,c.extraCount-hitExtra);
  let rewarded=game==='ssq'?(hitExtra>=1||hitMain>=4):(hitExtra>=2||(hitExtra>=1&&hitMain>=2)||hitMain>=3);
  if(rewarded)win+=copies;
 }
 return {game,main:m,extra:e,bets:n,cost:n*2,draws:total,jackpot:n/total,any:win/total,winDraws:win}
 }
 function hit(a,b){return a.filter(x=>b.includes(x)).length}
 function inspect(game,guess,draw,kill){const c=G[game],chosen=new Set(guess.main),killed=new Set(kill.main),good=draw.main||[];
 const picked=good.filter(n=>chosen.has(n)),killedActual=good.filter(n=>killed.has(n)),neutral=good.filter(n=>!chosen.has(n)&&!killed.has(n));
 const overlap=guess.main.filter(n=>killed.has(n));return {selected:picked,wronglyKilled:killedActual,neutral,selectedKilledOverlap:overlap,unselected:good.filter(n=>!chosen.has(n)),drawn:good.length,coverRate:guess.main.length/c.mainMax}
 }
 function killBacktest(game,rows,n=60){const c=G[game],r=validRows(game,rows).slice().reverse();if(r.length<n+120)throw Error('历史数据不足');let sample=r.slice(-n),misMain=0,misExtra=0,wholeClean=0,records=[];for(let i=r.length-n;i<r.length;i++){let past=r.slice(i-120,i).reverse(),km=softKill(past,game,'main',4),ke=softKill(past,game,'extra',1),wrong=km.filter(v=>r[i].main.includes(v)),wrongExtra=ke.filter(v=>r[i].extra.includes(v));misMain+=wrong.length;misExtra+=wrongExtra.length;wholeClean+=+(wrong.length===0);records.push({issue:r[i].issue,killed:km,wrong,extraKilled:ke,extraWrong:wrongExtra})}
 const draws=sample.length;return {game,draws,mainExclusions:draws*4,mainMistakes:misMain,mainPrecision:1-misMain/(draws*4),theoreticalMainPrecision:1-c.mainCount/c.mainMax,extraExclusions:draws,extraMistakes:misExtra,extraPrecision:1-misExtra/draws,theoreticalExtraPrecision:1-c.extraCount/c.extraMax,allMainClean:wholeClean,records}
 }
 function publicReview(game,records,reference={}){let result=[];for(const rec of (records||[]).filter(x=>x.game===game&&x.status==='settled'&&x.actual&&Array.isArray(x.picks))){let p=rec.picks.find(p=>p.mode==='analyst');let kill=p?.softKills?.main;if(!Array.isArray(kill)||kill.length===0)continue;let main=rec.actual.main,extra=rec.actual.extra;let common={game,issue:rec.actual.issue,policy:rec.policy,kill,mainKilledActual:hit(kill,main),extraKilledActual:hit(p.softKills.extra||[],extra),choices:[]};for(let mode of ['analyst','veteran','trend','random']){let pick=rec.picks.find(x=>x.mode===mode);if(!pick)continue;common.choices.push({mode,...inspect(game,pick,rec.actual,{main:kill})});}result.push(common)}return result}
 const api={G,choose,sorted,validRows,frequency,softKill,rated,build,validSelection,exact,hit,inspect,killBacktest,publicReview};root.V187Core=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
