/* 一等奖覆盖实验室 V15 — 只优化不同有效组合的覆盖，绝不宣称走势提高单注概率。 */
export const GAME_CONFIG={
 ssq:{name:'双色球',mainMax:33,extraMax:16,mainSize:6,extraSize:1,compoundMain:8,compoundExtra:1,defaultBudget:56},
 dlt:{name:'超级大乐透',mainMax:35,extraMax:12,mainSize:5,extraSize:2,compoundMain:7,compoundExtra:2,defaultBudget:42}
};
export function choose(n,k){if(!Number.isInteger(n)||!Number.isInteger(k)||n<k||k<0)return 0;let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return Math.round(v)}
export function ticketUniverse(g){const c=GAME_CONFIG[g];if(!c)throw Error('未识别彩种');return choose(c.mainMax,c.mainSize)*choose(c.extraMax,c.extraSize)}
export const pad=n=>String(n).padStart(2,'0');
export function validateTicket(g,main,extra,allowCompound=false){const c=GAME_CONFIG[g];if(!c)return false;const sizes=allowCompound?[[c.mainSize,c.extraSize],[c.compoundMain,c.compoundExtra]]:[[c.mainSize,c.extraSize]];
 return sizes.some(([m,e])=>main.length===m&&extra.length===e)&&[main,extra].every((a,i)=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(n=>Number.isInteger(n)&&n>=1&&n<=(i===0?c.mainMax:c.extraMax)));}
export function canon(main,extra){return `${[...main].sort((a,b)=>a-b).join('-')}|${[...extra].sort((a,b)=>a-b).join('-')}`}
export function single(g,main,extra,source='自选'){if(!validateTicket(g,main,extra))throw Error('无效的单式号码');return{main:[...main].sort((a,b)=>a-b),extra:[...extra].sort((a,b)=>a-b),source}}
export function* groups(arr,k,start=0,acc=[]){if(acc.length===k){yield [...acc];return}for(let i=start;i<=arr.length-(k-acc.length);i++)yield* groups(arr,k,i+1,[...acc,arr[i]])}
export function expand(g,main,extra,source='复式'){if(!validateTicket(g,main,extra,true))throw Error('无效的号码组合');const cfg=GAME_CONFIG[g];const out=[];for(const m of groups([...main].sort((a,b)=>a-b),cfg.mainSize))for(const e of groups([...extra].sort((a,b)=>a-b),cfg.extraSize))out.push(single(g,m,e,source));return out;}
export function parseLines(g,text){const lines=String(text??'').split(/\r?\n/),tickets=[],errors=[];if(lines.length>300)throw Error('每次最多解析300行号码，请分批导入');for(let i=0;i<lines.length;i++){
 const line=lines[i].trim();if(!line)continue;
 const splits=line.replace(/[＋｜]/g,'+').split('+');if(splits.length!==2){errors.push(`第${i+1}行：需使用 + 分隔主区和后区`);continue}
 const nums=s=>{const found=s.match(/\d+/g)||[];return found.map(Number)};
 const main=nums(splits[0]),extra=nums(splits[1]);if(!validateTicket(g,main,extra,true)){errors.push(`第${i+1}行：球数、范围或重复号码不合法`);continue}
 for(const t of expand(g,main,extra,main.length>GAME_CONFIG[g].mainSize?'已导入复式':'已导入单式'))tickets.push(t);
 }
 return{tickets,errors};}
export function uniqueTickets(g,tickets){const seen=new Set(),valid=[],duplicates=[];for(const t of tickets){if(!validateTicket(g,t.main||[],t.extra||[]))continue;const id=canon(t.main,t.extra);if(seen.has(id))duplicates.push(t);else{seen.add(id);valid.push(single(g,t.main,t.extra,t.source||'其他'))}}return {valid,duplicates};}
export function probability(g,n){const total=ticketUniverse(g);if(!Number.isInteger(n)||n<0||n>total)throw Error('覆盖注数不合法');return{total,unique:n,p:n/total,percent:n/total*100,oneIn:n?total/n:null,cost:n*2,relative:n};}
export function formatOdds(n){if(n==null)return'暂无有效组合';return `约 1 / ${n.toLocaleString('zh-CN',{maximumFractionDigits:2})}`;}
function secureInt(max){if(max<=0)throw Error('号码范围不合法');if(globalThis.crypto?.getRandomValues){const x=new Uint32Array(1),limit=Math.floor(0x100000000/max)*max;do{crypto.getRandomValues(x)}while(x[0]>=limit);return x[0]%max}return Math.floor(Math.random()*max)}
function randomPart(max,k){const a=Array.from({length:max},(_,i)=>i+1);for(let i=0;i<k;i++){const j=i+secureInt(max-i);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,k).sort((a,b)=>a-b)}
export function fillUnique(g,existing,target){if(!Number.isInteger(target)||target<0||target>250)throw Error('为避免盲目增加投入，单次只支持试算不超过250注');const cleaned=uniqueTickets(g,existing).valid;if(cleaned.length>target)throw Error(`当前已有${cleaned.length}注不同组合，超过本次预算可覆盖的${target}注，请先提高试算预算或清空`);
 const {mainMax,mainSize,extraMax,extraSize}=GAME_CONFIG[g],seen=new Set(cleaned.map(x=>canon(x.main,x.extra)));let remaining=target-cleaned.length,tries=0;
 while(remaining>0){if(++tries>50000)throw Error('去重生成超时，请减少目标注数');const m=randomPart(mainMax,mainSize),e=randomPart(extraMax,extraSize),id=canon(m,e);if(seen.has(id))continue;seen.add(id);cleaned.push(single(g,m,e,'不重复随机补足'));remaining--;}
 return cleaned;}
export function toCsv(g,tickets){return '\uFEFF彩种,主区,后区,组合来源\n'+tickets.map(t=>[GAME_CONFIG[g].name,`"${t.main.map(pad).join(' ')}"`,`"${t.extra.map(pad).join(' ')}"`,t.source].join(',')).join('\n')+'\n'}
export function line(t){return`${t.main.map(pad).join(' ')} + ${t.extra.map(pad).join(' ')}`}
const $=id=>document.getElementById(id);
const ui={game:'ssq',tickets:{ssq:[],dlt:[]},locked:{ssq:false,dlt:false},lastMessage:''};
const money=g=>Number($('oddsBudget')?.value||GAME_CONFIG[g].defaultBudget);
function getGame(){return document.querySelector('[data-game].active')?.dataset.game||'ssq'}
function render(){if(!$('oddsSummary'))return;ui.game=getGame();const g=ui.game,c=GAME_CONFIG[g],p=ticketUniverse(g),n=ui.tickets[g].length,b=Math.min(500,Math.max(0,money(g))),goal=Math.floor(b/2),compound=choose(c.compoundMain,c.mainSize)*choose(c.compoundExtra,c.extraSize);const exact=probability(g,n);
 $('oddsGameTitle').textContent=c.name+` · 一等奖覆盖 ${p.toLocaleString('zh-CN')} 种开奖结果`;
 $('oddsComboHint').textContent=`${c.compoundMain}+${c.compoundExtra} 复式 = ${compound}注 = ${compound*2}元；相同的${compound}注不同单式具有相同一等奖概率。`;
 $('oddsBudgetLabel').textContent=`￥${b.toFixed(0)}，最多 ${goal} 注不重复单式`;
 $('oddsSummary').innerHTML=`<div class="coverage-grid"><div class="coverage-metric"><span>当前不重复组合</span><strong>${n} 注</strong></div><div class="coverage-metric"><span>当前模拟金额</span><strong>¥${exact.cost}</strong></div><div class="coverage-metric"><span>一等奖精确概率</span><strong>${(exact.percent).toFixed(7)}%</strong></div><div class="coverage-metric"><span>一等奖概率倒数（非预期必中期数）</span><strong>${formatOdds(exact.oneIn)}</strong></div></div><p class="footnote">此处仅为概率倒数的数学表达，不代表购买相应次数后必定中奖。固定预算下，相同数量的不同号码组合概率相等。${n>goal?'当前号码数超过试算预算。':''}</p>`;
 $('oddsList').textContent=n?ui.tickets[g].map((t,i)=>`${i+1}. ${line(t)}　${t.source}`).join('\n'):'尚未加入号码。可一键导入 A/B/C 候选、粘贴复式或直接随机补齐。';
 $('oddsStatus').textContent=ui.lastMessage||'只生成研究清单，不会自动购买彩票。';
}
function setMessage(msg){ui.lastMessage=msg;render()}
function captureMix(){const g=getGame(),getter=window.getResearchPicksForCoverage;const picks=typeof getter==='function'?getter():[];
 if(!picks.length){setMessage('A/B/C 尚无可用号码。请先同步至少30期真实历史数据，或直接生成不重复组合。');return;}
 const next=uniqueTickets(g,[...ui.tickets[g],...picks.map(p=>single(g,p.main,p.extra,'研究员 '+(p.mode==='analyst'?'A':p.mode==='veteran'?'B':'C')))]);
 ui.tickets[g]=next.valid;setMessage(`已加入${picks.length}组研究员候选；本次合并剔除${next.duplicates.length}组重复组合。研究员号码与其他不重复组合的一等奖概率相同。`)
}
function importText(){const g=getGame();try{const t=parseLines(g,$('oddsPaste').value);const merged=uniqueTickets(g,[...ui.tickets[g],...t.tickets]);ui.tickets[g]=merged.valid;setMessage(`已识别${t.tickets.length}注（复式已展开）；合并后${merged.valid.length}注不同组合，重复${merged.duplicates.length}注。${t.errors.length?'输入问题：'+t.errors.slice(0,3).join('；'):''}`)}catch(e){setMessage('导入失败：'+e.message)}}
function fill(){const g=getGame(),budget=money(g);if(!Number.isFinite(budget)||budget<2||budget>500||budget%2!==0){setMessage('请输入2～500元的偶数预算；仅为研究试算，不建议根据概率提高原定预算。');return}
 try{ui.tickets[g]=fillUnique(g,ui.tickets[g],budget/2);setMessage(`已达到￥${budget}预算上限，生成 ${ui.tickets[g].length}注完全不重复的有效组合；数学上一等奖概率为 ${(ui.tickets[g].length/ticketUniverse(g)*100).toFixed(7)}%。`)}catch(e){setMessage(e.message)}}
function copy(){const g=getGame(),str=ui.tickets[g].map(line).join('\n');if(!str){setMessage('没有可复制的组合');return}if(navigator.clipboard?.writeText){navigator.clipboard.writeText(str).then(()=>setMessage('号码已复制，保留在本机。')).catch(()=>setMessage('复制受限，请长按下方列表复制。'))}else setMessage('请长按下方列表复制。')}
function exportCsv(){const g=getGame(),tickets=ui.tickets[g];if(!tickets.length){setMessage('没有可导出的组合');return}const blob=new Blob([toCsv(g,tickets)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`一等奖不重复覆盖_${g}_${tickets.length}注.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);setMessage('已下载 CSV。此研究清单不包含购票凭证。')}
function init(){if(!$('oddsBudget'))return;
 // 每个彩种分别记录用户填写的模拟预算，不自动增加投入。
 const limits={ssq:56,dlt:42};const btns=document.querySelectorAll('[data-game]');btns.forEach(btn=>btn.addEventListener('click',()=>{const g=btn.dataset.game;const curr=getGame();if(g!==ui.game){ui.game=g;$('oddsBudget').value=limits[g];ui.lastMessage='';render()}}));
 document.querySelector('[data-page="coverage"]')?.addEventListener('click',render);
 $('oddsBudget').addEventListener('input',()=>{limits[getGame()]=$('oddsBudget').value;render()});
 $('oddsImport').addEventListener('click',importText);
 $('oddsResearchers').addEventListener('click',captureMix);
 $('oddsFill').addEventListener('click',fill);
 $('oddsClear').addEventListener('click',()=>{ui.tickets[getGame()]=[];ui.lastMessage='已清空本页研究篮子，不影响守号或公开研究档案。';render()});
 $('oddsCopy').addEventListener('click',copy);
 $('oddsExport').addEventListener('click',exportCsv);
 render();}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()}
