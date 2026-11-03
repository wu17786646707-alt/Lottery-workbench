/** V16 shape-first, one-compound-at-a-time research view. */
import {pickV15,makeCompoundV15,MODE_LABELS} from './multiwindow.js?v=16.0';
import {shapePlan,softKill,exclusionRisk,featuresOf,extraShape,SHAPE_POLICY} from './shape-engine.js?v=16.0';
import {GAMES,pad,escapeHTML as esc,hash} from './core.js?v=16.0';
const el=id=>document.getElementById(id);
const modes=['analyst','veteran','trend'];
let result=null,previousGame=null;
function context(){return typeof window.getV15Context==='function'?window.getV15Context():{game:'ssq',rows:[]}}
const nums=p=>p.main.map(pad).join(' ')+' + '+p.extra.map(pad).join(' ');
function balls(p){return `<div class="balls">${p.main.map(n=>`<span class="ball">${pad(n)}</span>`).join('')}${p.extra.map(n=>`<span class="ball extra">${pad(n)}</span>`).join('')}</div>`}
const fmtShape=x=>`龙头${pad(x.head)} · 凤尾${pad(x.tail)} · 三区${x.zones.join(':')} · 和值${x.sum} · 跨度${x.span} · 奇偶${x.odd}:${x.zones.reduce((a,b)=>a+b,0)-x.odd} · 重号${x.repeat} · 连号${x.adj}对 · 邻号${x.neighbor}个 · 三期斜连${x.diagonal}个`;
function update(){const c=context(),g=c.game,basic=g==='ssq'?56:42;if(previousGame!==g){previousGame=g;result=null;el('v16Budget').value=basic;el('v16Mode').value='veteran';el('v16Research').textContent='请点击“生成形态先行研究”，查看三位研究员的方案和主推复式。';el('v16Primary').textContent='尚无主方案。';el('v16Alternatives').textContent='请先生成研究。'}
 el('v16Game').textContent=`当前彩种：${GAMES[g].name}；${g==='ssq'?'8+1、28注、56元':'7+2、21注、42元（不追加）'}。`;
 el('v16Proof').textContent=c.rows.length?`最新收录 ${esc(c.rows[0]?.issue)} 期，历史样本 ${c.rows.length} 期。未通过官方独立核验时，不把单源统计当作官方认定数据。`:'当前尚无有效历史数据。';
 if(result&&result.game!==c.game)result=null;
 if(result)render();
}
function lineEx(p){return p.explain.map(x=>`<div class="v16-explain"><strong>${x.kind==='main'?'主区':'后区'} ${pad(x.number)}</strong><span>${esc(x.reason)}</span></div>`).join('')}
function shapeHTML(p,comparison=false){const s=p.shapeActual,tar=p.shapePlan?.target;const extra=extraShape(p.extra,p.game);
 return `<div class="v16-shape"><b>${comparison?'复式':'单式'}实际形态</b><p>${s?fmtShape(s):'无形态'}。</p><p>${p.game==='ssq'?'蓝球':'后区'}：${extra.odd}奇${extra.even}偶，${extra.small}小${extra.large}大${extra.gap===null?'':'，间距'+extra.gap}。</p>${tar?`<p class="small">事先确定的候选目标：三区${tar.zones.join(':')}、龙头范围${tar.headBand.join('～')}、凤尾范围${tar.tailBand.join('～')}、和值观察区间${tar.sumBand.join('～')}、跨度观察区间${tar.spanBand.join('～')}。该目标是评分参考，允许结果偏离。</p>`:''}</div>`}
function riskHTML(g,main,extra){const k=exclusionRisk(g,'main',main.length),e=exclusionRisk(g,'extra',extra.length);return `如果真的硬排除 ${main.length} 个主区、${extra.length} 个后区号码，公平随机模型下<strong>主区至少误杀1个的概率约${(k.anyHit*100).toFixed(1)}%</strong>、后区约${(e.anyHit*100).toFixed(1)}%；两区都未误杀的概率约${(k.clean*e.clean*100).toFixed(1)}%。软杀号不进行这种实际排除。`}
function current(){const c=context();if(!result||result.game!==c.game||result.issue!==c.rows[0]?.issue||result.fingerprint!==hash(JSON.stringify(c.rows.slice(0,300).map(x=>[x.issue,x.date,x.main,x.extra]))))throw Error('数据已变化，请重新生成研究候选');return result}
function generate(){const c=context(),w=Number(el('v16Window').value)||120;if(c.rows.length<30){el('v16Research').textContent='至少需要30期有效历史数据，请先同步';return}
 const fingerprint=hash(JSON.stringify(c.rows.slice(0,300).map(x=>[x.issue,x.date,x.main,x.extra])));
 const studies=modes.map(mode=>{const single=pickV15(c.rows,c.game,mode,{window:w,search:450});const compound=makeCompoundV15(c.rows,c.game,mode,{window:w,search:450});return{mode,single,compound}});
 const mainLow=softKill(c.rows,c.game,'main',4),extraLow=softKill(c.rows,c.game,'extra',c.game==='ssq'?1:2);
 result={policy:SHAPE_POLICY,game:c.game,issue:c.rows[0].issue,asOf:c.rows[0].date,fingerprint,createdAt:new Date().toISOString(),window:w,studies,softKill:{main:mainLow,extra:extraLow}};
 render();}
function render(){if(!result)return;const r=result,c=context();if(r.game!==c.game)return;if(r.fingerprint!==hash(JSON.stringify(c.rows.slice(0,300).map(x=>[x.issue,x.date,x.main,x.extra])))){result=null;el('v16Primary').textContent='历史数据已更新，请重新生成本期研究。';el('v16Select').disabled=true;el('v16Copy').disabled=true;el('v16Export').disabled=true;return}const low=r.softKill;
 el('v16Research').innerHTML=`<div class="item"><strong>分析基准：第${esc(r.issue)}期</strong><p class="small">${esc(r.policy)} · 三位研究员共用真实开奖快照、分别采用不同的形态偏好和号码排序。系统不会给出“下一期号码概率最大”的无证据结论。</p><p class="small">${riskHTML(r.game,low.main,low.extra)}</p><details><summary>展开软杀号：哪些号码被降权、为什么？</summary><div class="v16-shape-grid">${[['主区',low.main],['后区',low.extra]].map(([label,a])=>`<div class="item"><b>${label}</b>${a.map(x=>`<p class="small">${pad(x.number)}：${esc(x.reason)}</p>`).join('')}</div>`).join('')}</div></details></div>`+
 r.studies.map(x=>`<article class="v16-research-card"><div class="row wrap"><h3>${esc(MODE_LABELS[x.mode])}</h3><span class="tag">形态先行 · ${r.window}期</span></div><p class="small">${esc(x.single.shapePlan?.reason||'历史形态研究')}</p><h4>单式候选</h4>${balls(x.single)}${shapeHTML(x.single)}<details><summary>逐球解释与软杀号记录</summary><div class="v16-explain-grid">${lineEx(x.single)}</div></details><p class="small">同一研究员的${r.game==='ssq'?'8+1':'7+2'}复式包含这组单式。该研究员的复式属于比较方案，不是必须购买的建议。</p></article>`).join('');
 const selected=el('v16Mode').value,pick=r.studies.find(x=>x.mode===selected)||r.studies[1],p=pick.compound,budget=Math.max(0,Math.floor(Number(el('v16Budget').value)||0)),eligible=budget>=p.cost;
 const theory=r.game==='ssq'?17721088:21425712;
 el('v16Primary').innerHTML=`<div class="v16-primary-top"><strong>主展示：${esc(MODE_LABELS[selected])}的${r.game==='ssq'?'8+1':'7+2'}复式</strong><span class="tag">仅一组 · ${p.bets}注 · ${p.cost}元</span></div>${balls(p)}${shapeHTML(p,true)}<p class="small">${esc(pick.single.shapePlan?.reason||'基于形态研究')}。当前研究员的单式已被复式包含，不需要另加重复的一注。</p><p class="small">公平随机下，这一组复式覆盖 ${p.bets} 种开奖结果，对应一等奖概率约 ${(p.bets/theory*100).toFixed(6)}%，与任何其他${p.bets}注不重复的组合相同。</p><p class="${eligible?'footnote':'v16-warning'}">${eligible?`预算上限${budget}元，可覆盖这${p.cost}元的方案；剩余金额${budget-p.cost}元不会自动加注。`:`预算上限${budget}元，小于${p.cost}元：本页不产生可选的复式主方案，不提示你加预算。`}</p><details><summary>展开主展示复式的逐球依据</summary><div class="v16-explain-grid">${lineEx(p)}</div></details>`;
 el('v16Select').disabled=!eligible;el('v16Copy').disabled=!eligible;el('v16Export').disabled=!eligible;
 el('v16Alternatives').innerHTML=r.studies.filter(x=>x.mode!==selected).map(x=>`<div class="item"><strong>${esc(MODE_LABELS[x.mode])}</strong>${balls(x.compound)}<p class="small">${x.compound.bets}注 · ${x.compound.cost}元。仅用于方案比较，默认不加入主展示，也不自动扩大预算。</p><details><summary>查看备选方案的形态</summary>${shapeHTML(x.compound,true)}</details></div>`).join('');
}
function singlePrimary(){const r=current(),mode=el('v16Mode').value,p=r.studies.find(x=>x.mode===mode).compound,b=Math.max(0,Math.floor(Number(el('v16Budget').value)||0));if(b<p.cost)throw Error('当前预算不足以覆盖复式；保持原预算，不自动推荐增加投入');return p}
function select(){try{const p=singlePrimary();if(typeof window.useV16PrimaryCompound!=='function')throw Error('旧版复式保存入口暂不可用');window.useV16PrimaryCompound(p);el('v16Message').textContent='已把这一组放进“复式选号”页面供核对；尚未保存为守号，也不会自动购买。'}catch(e){el('v16Message').textContent=e.message}}
async function copy(){try{const p=singlePrimary();const s=`${GAMES[p.game].name} ${p.snapshot.baseIssue}期后研究复式 · ${MODE_LABELS[p.mode]}\n${nums(p)}\n${p.bets}注 / ${p.cost}元基本投注\n形态：${fmtShape(p.shapeActual)}\n仅研究候选，单注无额外一等奖概率优势。`;if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(s);else throw Error('浏览器不支持快捷复制');el('v16Message').textContent='已复制所选的一组复式（不包含其余两组）'}catch(e){el('v16Message').textContent=e.message}}
function exportJSON(){try{const p=singlePrimary(),r=current();const data={schema:'lottery-v16-primary-compound',game:r.game,baseIssue:r.issue,window:r.window,policy:r.policy,primaryMode:p.mode,main:p.main,extra:p.extra,bets:p.bets,cost:p.cost,reason:p.shapePlan?.reason,shape:p.shapeActual,dataHash:r.fingerprint,note:'仅导出一组复式，不自动购买；不是GitHub公开时间锁定证明'};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`V16_唯一主复式_${r.game}_${r.issue}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);el('v16Message').textContent='已导出一组主展示复式研究卡片';}catch(e){el('v16Message').textContent=e.message}}
function init(){if(!el('v16Run'))return;el('v16Run').addEventListener('click',()=>{try{generate()}catch(e){el('v16Research').textContent='研究失败：'+e.message}});el('v16Window').addEventListener('change',()=>{result=null;el('v16Primary').textContent='观察窗口已改变，请重新研究';});el('v16Mode').addEventListener('change',render);el('v16Budget').addEventListener('input',render);el('v16Select').addEventListener('click',select);el('v16Copy').addEventListener('click',copy);el('v16Export').addEventListener('click',exportJSON);
 document.querySelector('[data-page="shape"]')?.addEventListener('click',update);
 document.querySelectorAll('[data-game]').forEach(b=>b.addEventListener('click',()=>{setTimeout(update,0)}));window.renderV16Shape=update;update();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
