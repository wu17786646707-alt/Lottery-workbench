/** V18 next-draw decision screen: one explicit target, 30/120/300 fact evidence,
 * analyst-generated tickets, single-budget compound choice and no post hoc editing.
 */
import {pickV15,makeCompoundV15,MODE_LABELS} from './multiwindow.js?v=18.0';
import {GAMES,pad,escapeHTML as escape,hash} from './core.js?v=18.0';
import {issueContext,fmtBase,fmtTarget,statusText} from './issue-context.js?v=18.0';
import {ballFacts,rolling30,selectCompound,COMPOUND_TYPES} from './decision-engine.js?v=18.0';
const $=id=>document.getElementById(id);
const fmt=arr=>(arr||[]).map(pad).join(' ');
const balls=(main,extra)=>`<div class="balls">${main.map(n=>`<span class="ball">${pad(n)}</span>`).join('')}${extra.map(n=>`<span class="ball extra">${pad(n)}</span>`).join('')}</div>`;
function context(){return window.getV15Context?.()||{game:'ssq',rows:[],publicLog:null}}
function stage(c){return issueContext(c.game,c.rows,c.publicLog)}
let lastGame=null,cached=null,cacheKey='';let currentPlan=null;
function showStatus(message,isError=false){const node=$('v18Status');node.textContent=message;node.className=isError?'v18-error':'footnote'}
function screen(){
 if(!$('v18Run'))return;
 const c=context(),g=c.game,t=stage(c);
 if(lastGame!==g){lastGame=g;$('v18Template').innerHTML=COMPOUND_TYPES[g].map((x,i)=>`<option value="${x}">${x}${i?'（后区覆盖型）':'（主区覆盖型）'}</option>`).join('');$('v18Budget').value=g==='ssq'?56:42;currentPlan=null;cached=null;cacheKey='';}
 $('v18Status').textContent=c.rows.length?`${fmtBase(t)} → 研究目标：${fmtTarget(t)}。${statusText(t)} 当前候选是本机即时计算，不等于 GitHub 提前锁定。`:'没有已收录的真实开奖，请先到“数据与备份”同步。';
 $('v18Run').disabled=!t.canRecommend||c.rows.length<30;
 if(currentPlan&&(currentPlan.game!==g||currentPlan.baseIssue!==c.rows[0]?.issue||!t.canRecommend)){
  currentPlan=null;$('v18Picks').innerHTML='<p class="sub">当前研究期次或彩种已经改变。旧号码已停止作为下一期候选显示；请先同步并重新生成。</p>';
 }
 $('v18ToCompound').disabled=!currentPlan||Number($('v18Budget').value)<currentPlan?.compound?.cost;
 renderFrequency(c);
}
function fullTables(c,part,selected){
 const fs=ballFacts(c.rows,c.game,part),count=part==='main'?GAMES[c.game].mainCount:GAMES[c.game].extraCount,
 max=part==='main'?GAMES[c.game].mainMax:GAMES[c.game].extraMax;
 const rows=(arr)=>`<div class="table-scroll"><table class="v18-table"><thead><tr><th>号码</th><th>近30期</th><th>近120期</th><th>近300期</th><th>遗漏</th><th>当前类别</th></tr></thead><tbody>${arr.map(f=>`<tr class="${selected?.includes(f.n)?'v18-selected':''}"><th>${pad(f.n)}${selected?.includes(f.n)?' ★':''}</th><td>${f.counts[30]}</td><td>${f.counts[120]}</td><td>${f.counts[300]}</td><td>${f.miss}</td><td>${f.counts[30]>f.expected[30]?'高于均值':f.counts[30]<f.expected[30]?'低于均值':'接近均值'}</td></tr>`).join('')}</tbody></table></div>`;
 const top=[...fs].sort((a,b)=>b.counts[30]-a.counts[30]||a.n-b.n).slice(0,7);
 const cold=[...fs].sort((a,b)=>a.counts[30]-b.counts[30]||a.n-b.n).slice(0,7);
 const overdue=[...fs].sort((a,b)=>b.miss-a.miss||a.n-b.n).slice(0,6);
 return `<div class="v18-fact-block"><h4>${escape(part==='main'?GAMES[c.game].mainName:GAMES[c.game].extraName)}：近30期统计</h4><p class="small">单个号码的公平随机理论出现率 ${(100*count/max).toFixed(2)}%，30期理论平均 ${(30*count/max).toFixed(2)}次。以下统计为过去事实，不是下一期开出概率排名。</p><p class="small">近期高频：${top.map(x=>pad(x.n)+'('+x.counts[30]+'次)').join('、')}</p><p class="small">近期低频：${cold.map(x=>pad(x.n)+'('+x.counts[30]+'次)').join('、')}</p><p class="small">当前长遗漏：${overdue.map(x=>pad(x.n)+'('+x.miss+'期)').join('、')}</p>${selected?rows(fs.filter(f=>selected.includes(f.n))):''}<details><summary>展开全部${fs.length}个号码：30／120／300期、遗漏</summary>${rows(fs)}</details></div>`;
}
function renderFrequency(c){if(c.rows.length<30){$('v18Facts').textContent='真实历史数据不足30期，不生成统计或预测。';$('v18Backtest').textContent='请先同步历史数据。';return}
 const ckey=c.game+'|'+c.rows[0].issue+'|'+c.rows.length;
 if(cacheKey!==ckey){try{cached={main:rolling30(c.rows,c.game,'main',500),extra:rolling30(c.rows,c.game,'extra',500),oldMain:rolling30(c.rows,c.game,'main',500,500),oldExtra:rolling30(c.rows,c.game,'extra',500,500)};cacheKey=ckey;}catch(e){cached=null;$('v18Backtest').textContent='滚动检验暂不可用：'+e.message}}
 const m=cached?.main,old=cached?.oldMain;
 if(m?.n&&old?.n){$('v18Backtest').innerHTML=`<div class="v18-fact-block"><h4>近30期热号能否预测下一期？</h4><p class="small">方法：每次只看过去30期，取主区出现次数最多的${GAMES[c.game].mainCount}个号码，在随后一期核对平均命中；与等量随机理论比较。没有事后挑选赢家。</p><div class="table-scroll"><table class="v18-table"><thead><tr><th>时间段</th><th>30期热号平均命中</th><th>30期冷号平均命中</th><th>随机理论平均</th></tr></thead><tbody>${[[m,'较近'+m.n+'期'],[old,'再往前'+old.n+'期']].map(([r,label])=>`<tr><td>${label}</td><td>${r.hotMean.toFixed(3)}</td><td>${r.coldMean.toFixed(3)}</td><td>${r.theory.toFixed(3)}</td></tr>`).join('')}</tbody></table></div><p class="footnote">命中主区的平均个数不等于一等奖概率；分段结果不稳定时，不能宣称热号有可持续预测优势。</p></div>`;}
 $('v18Facts').innerHTML=fullTables(c,'main',currentPlan?.single.main)+fullTables(c,'extra',currentPlan?.single.extra);
}
function explain(c,p){const prior=ballFacts(c.rows,c.game,'main'),back=ballFacts(c.rows,c.game,'extra');const facts={main:new Map(prior.map(x=>[x.n,x])),extra:new Map(back.map(x=>[x.n,x]))};
 return (p.explain||[]).map(x=>{const f=facts[x.kind].get(x.number);return `<tr><td>${x.kind==='main'?'主区':'后区'} ${pad(x.number)}</td><td>${f?.counts[30]??'—'}</td><td>${f?.counts[120]??'—'}</td><td>${f?.counts[300]??'—'}</td><td>${f?.miss??'—'}</td><td>${escape(x.reason||'策略候选，未记录解释')}</td></tr>`}).join('')}
function renderCandidate(){if(!currentPlan)return;const c=context(),x=currentPlan,t=stage(c),budget=Math.max(0,Number($('v18Budget').value)||0),eligible=budget>=x.compound.cost;
 const s=x.single,b=x.compound;
 const plan=s.shapePlan?.target;
 $('v18Picks').innerHTML=`<div class="v18-ticket"><p class="small"><strong>研究目标：${escape(fmtTarget(t))}</strong>；仅使用已开奖第${escape(x.baseIssue)}期及之前的数据。研究员：${escape(MODE_LABELS[x.mode])}，本机即时生成，未自动成为公开赛前档案。</p><h3>单式候选（研究，不等于购彩）</h3>${balls(s.main,s.extra)}<p class="small">${escape(s.shapePlan?.reason||'多窗口历史统计与形态实验')}</p><h3>唯一主复式 · ${b.main.length}+${b.extra.length}</h3>${balls(b.main,b.extra)}<p class="small">${b.bets}注／基本投注${b.cost}元；${escape(b.origin||'同预算复式')}。这是在同一预算中选择一种结构，不会加入另一份复式。</p><p class="${eligible?'footnote':'v18-error'}">${eligible?`当前预算${budget}元，候选基本金额${b.cost}元，剩余不会自动用于加注。`:`预算${budget}元不足${b.cost}元，复式选择已禁用，不建议加预算。`}</p>${plan?`<p class="small">提前研究的形态区间：三区${escape(plan.zones.join(':'))}、龙头${escape(plan.headBand.join('～'))}、凤尾${escape(plan.tailBand.join('～'))}、和值${escape(plan.sumBand.join('～'))}。允许实际方案偏离区间。</p>`:''}<details open><summary>展开本组选球依据：近30／120／300期与遗漏</summary><div class="table-scroll"><table class="v18-table"><thead><tr><th>号码</th><th>30期</th><th>120期</th><th>300期</th><th>遗漏</th><th>为什么选</th></tr></thead><tbody>${explain(c,b)}</tbody></table></div></details><p class="footnote">此报告不宣称任一号码真实开出概率更大；数据库标记 ${escape(c.rows[0].verification||'未独立核验')}。单式属于复式覆盖内，无需重复叠加。实际购彩仅以销售系统确认的票据为准。</p></div>`;
 $('v18ToCompound').disabled=!eligible;$('v18Copy').disabled=false;$('v18Facts').innerHTML=fullTables(c,'main',s.main)+fullTables(c,'extra',s.extra);
}
function compute(){const c=context(),t=stage(c);if(!t.canRecommend||c.rows.length<30){showStatus('目标期开奖可能已过，或真实历史数据不足；请先同步，不允许把上一期号码当成下一期。',true);return}
 try{
 const mode=$('v18Mode').value,template=$('v18Template').value,win=Number($('v18Window').value)||120;
 const single=pickV15(c.rows,c.game,mode,{window:win,search:450}),primary=makeCompoundV15(c.rows,c.game,mode,{window:win,search:450}),compound=selectCompound(c.rows,c.game,primary,template);
 const correct=single.main.every(n=>compound.main.includes(n))&&single.extra.every(n=>compound.extra.includes(n));if(!correct)throw Error('复式没有包含单式，请不要使用当前候选');
 const sig=hash(JSON.stringify(c.rows.slice(0,300).map(x=>[x.issue,x.date,x.main,x.extra])));
 currentPlan={game:c.game,baseIssue:c.rows[0].issue,mode,window:win,template,single,compound,signature:sig};
 showStatus(`${fmtBase(t)} → 目标${fmtTarget(t)}；只形成一组${template}复式；已核验包含本研究员单式。`);
 renderCandidate();
 }catch(e){currentPlan=null;$('v18ToCompound').disabled=true;$('v18Picks').textContent='生成失败：'+e.message;showStatus(e.message,true)}
}
function checked(){const c=context(),t=stage(c);if(!currentPlan||!t.canRecommend||currentPlan.game!==c.game||currentPlan.baseIssue!==c.rows[0]?.issue||currentPlan.signature!==hash(JSON.stringify(c.rows.slice(0,300).map(x=>[x.issue,x.date,x.main,x.extra]))))throw Error('候选已经过期，请同步并重新生成');return currentPlan;}
function use(){try{const p=checked(),budget=Number($('v18Budget').value);if(budget<p.compound.cost)throw Error('当前预算不足，无法选此复式');if(typeof window.useV17PrimaryCompound!=='function')throw Error('复式保存页尚未就绪');window.useV17PrimaryCompound(p.compound)}catch(e){showStatus(e.message,true)}}
async function copy(){try{const p=checked(),c=context(),t=stage(c);const text=`${GAMES[p.game].name} · ${fmtTarget(t)} · 依据第${p.baseIssue}期\n${MODE_LABELS[p.mode]}研究单式：${fmt(p.single.main)} + ${fmt(p.single.extra)}\n唯一复式${p.template}：${fmt(p.compound.main)} + ${fmt(p.compound.extra)}\n${p.compound.bets}注／${p.compound.cost}元基本投注\n每个号码的30/120/300期频率与遗漏可在网页逐球表中核对；本机即时研究，尚未公开锁定。不保证中奖。`;
 if(!navigator.clipboard?.writeText)throw Error('当前浏览器不能直接复制');await navigator.clipboard.writeText(text);showStatus('已复制一组目标期次明确的研究卡片，没有叠加其他研究员的复式。');}catch(e){showStatus(e.message,true)}}
function reset(){currentPlan=null;$('v18Picks').textContent='当前尚未生成具体候选。先核实数据，再选择研究员、复式结构与预算。';$('v18ToCompound').disabled=true;$('v18Copy').disabled=true;screen()}
function init(){if(!$('v18Run'))return;
 $('v18Run').addEventListener('click',compute);$('v18ToCompound').addEventListener('click',use);$('v18Copy').addEventListener('click',copy);
 ['v18Mode','v18Window','v18Template'].forEach(id=>$(id).addEventListener('change',reset));$('v18Budget').addEventListener('input',()=>{if(currentPlan)renderCandidate()});
 document.querySelector('[data-page="decision"]')?.addEventListener('click',screen);
 document.querySelectorAll('[data-game]').forEach(b=>b.addEventListener('click',()=>setTimeout(reset,0)));
 window.renderV18Decision=screen;screen();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
