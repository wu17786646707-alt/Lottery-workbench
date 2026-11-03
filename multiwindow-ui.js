/* V15 mobile multi-window research report UI. No purchase functionality. */
import {factTable,patterns,pickV15,makeCompoundV15,backtestV15,WINDOWS,MODE_LABELS,MW_POLICY} from './multiwindow.js?v=16.0';
import {GAMES,pad,hash,escapeHTML as E} from './core.js?v=16.0';
const $=id=>document.getElementById(id);
let report=null,oldKey='',lastBacktest=null;
function ctx(){return typeof window.getV15Context==='function'?window.getV15Context():{game:'ssq',rows:[]}}
function keyOf(c){const fingerprint=hash(JSON.stringify((c.rows||[]).slice(0,300).map(x=>[x.issue,x.date,x.main,x.extra])));return `${c.game}|${c.rows[0]?.issue||'empty'}|${$('v15Primary')?.value||120}|${fingerprint}`} 
function money(n){return Number(n).toLocaleString('zh-CN')}
function balls(main,extra){return `<div class="balls">${main.map(n=>`<span class="ball">${pad(n)}</span>`).join('')}${extra.map(n=>`<span class="ball extra">${pad(n)}</span>`).join('')}</div>`}
const fmt=(p)=>`${p.main.map(pad).join(' ')} + ${p.extra.map(pad).join(' ')}`;
function ensureReport(){const c=ctx();if(c.rows.length<30)throw Error('有效历史期数不足30期，请先进入“数据与备份”同步');const key=keyOf(c);if(key===oldKey&&report)return report;
 const win=Number($('v15Primary').value)||120,strategies=['analyst','veteran','trend'];
 const picks=strategies.map(mode=>({mode,single:pickV15(c.rows,c.game,mode,{window:win}),compound:makeCompoundV15(c.rows,c.game,mode,{window:win})}));
 const sensitivity=Object.fromEntries(strategies.map(mode=>[mode,[60,120,300].map(window=>{const x=pickV15(c.rows,c.game,mode,{window});return {window,main:x.main,extra:x.extra}})]));
 report={schema:'lottery-multiwindow-report-v15',generatedAt:new Date().toISOString(),game:c.game,baseIssue:c.rows[0].issue,baseDate:c.rows[0].date,
  policy:MW_POLICY,primaryWindow:win,sensitivity,verification:c.rows[0].verification||'unknown',source:c.source,picks,
  warnings:['选号评分不是下一期开出概率','本报告是当下即时计算结果，未自动记入 GitHub 提前锁定记录']};
 oldKey=key;return report;
}
function status(){const c=ctx(),rows=c.rows||[];if(!$('v15DataStatus'))return;
 if(rows.length<30){$('v15DataStatus').textContent=`目前仅有${rows.length}期本机历史数据，请先同步至少30期，不会使用虚构数据代替。`;return}
 const last=rows[0];$('v15DataStatus').textContent=`${GAMES[c.game].name} · 基准第${last.issue}期（${last.date}） · 已收录${money(rows.length)}期 · 最近一期核验标记：${last.verification||'未标注'}。仅以前已记录的开奖作为输入。`;
}
function renderFacts(){const c=ctx(),rows=c.rows||[];if(rows.length<30){$('v15FactTable').textContent='历史数据不足';$('v15Top').textContent='';return}
 const part=$('v15Part').value,g=GAMES[c.game],d=factTable(rows,c.game,part),r=d.rows;
 const nCount=Math.min(300,rows.length),p=d.k/d.max;
 const hot=[...r].sort((a,b)=>b.counts[60]-a.counts[60]||a.n-b.n).slice(0,6);
 const cold=[...r].sort((a,b)=>a.counts[60]-b.counts[60]||a.n-b.n).slice(0,6);
 const miss=[...r].sort((a,b)=>b.miss-a.miss||a.n-b.n).slice(0,6);
 $('v15Top').innerHTML=`<div class="v15-summary-grid"><div><strong>近60期高频观察</strong><p>${hot.map(x=>pad(x.n)+'（'+x.counts[60]+'次）').join(' · ')}</p></div><div><strong>近60期低频观察</strong><p>${cold.map(x=>pad(x.n)+'（'+x.counts[60]+'次）').join(' · ')}</p></div><div><strong>当前遗漏较长</strong><p>${miss.map(x=>pad(x.n)+'（'+x.miss+'期）').join(' · ')}</p></div></div><p class="footnote">${E(part==='main'?g.mainName:g.extraName)}：公平随机下单个号码每期出现概率为 ${(p*100).toFixed(2)}%；近60期理论平均出现 ${(Math.min(60,rows.length)*p).toFixed(2)} 次。历史热、冷、遗漏不改变其下一期理论概率。</p>`;
 $('v15FactTable').innerHTML='<table class="v15-table"><thead><tr><th>号码</th><th>20期</th><th>60期</th><th>120期</th><th>300期</th><th>全历史</th><th>遗漏</th><th>10期走势差</th><th>20期走势差</th><th>40期走势差</th></tr></thead><tbody>'+r.map(x=>`<tr><th>${pad(x.n)}${x.latest?' ●':''}</th>${WINDOWS.map(w=>`<td>${x.counts[w]}<small>/${x.lengths[w]}</small></td>`).join('')}<td>${x.counts.all}<small>/${x.lengths.all}</small></td><td>${x.miss}</td>${[10,20,40].map(w=>`<td class="${x.trend[w]>0?'v15-up':x.trend[w]<0?'v15-down':''}">${x.trend[w]>0?'+':''}${(x.trend[w]*100).toFixed(1)}pp</td>`).join('')}</tr>`).join('')+'</tbody></table>';
}
function renderPicks(){if(!report)return;$('v15Picks').innerHTML=report.picks.map(({mode,single,compound})=>{
 const ex=single.explain.map(x=>`<div class="v15-explain"><b>${x.kind==='main'?'主区':'后区'} ${pad(x.number)}</b><span>${E(x.reason)}</span></div>`).join('');
 const fee=compound.cost,shape=single.pattern;
 return `<article class="v15-researcher"><div class="row wrap"><h3>${E(MODE_LABELS[mode])}</h3><span class="tag">${E(single.snapshot.policy)}</span></div><h4>单式候选</h4>${balls(single.main,single.extra)}<p class="small">${E(single.summ.text)}</p><h4>同一策略的${report.game==='ssq'?'8+1':'7+2'}复式</h4>${balls(compound.main,compound.extra)}<p class="small">${compound.bets}注，基本投注${fee}元；${report.game==='dlt'?'若追加则63元；':''}包含上方这注单式。重号${compound.pattern.repeat}个、连号${compound.pattern.adjacent}对。</p><details><summary>逐个号码为什么选它？（含频率、遗漏、评分）</summary><div class="v15-explain-list">${ex}</div><p class="footnote">复式额外选入主区：${compound.main.filter(n=>!single.main.includes(n)).map(pad).join('、')}。这是策略覆盖选择，不是更高的单注一等奖概率。</p></details></article>`;
 }).join('')+'<div class="item"><h3>60 / 120 / 300 期权重敏感性</h3><p class="small">同一历史基准，用不同主参考窗口重新生成的结果。号码变化说明方法依赖参数，并不说明哪个窗口更准确。</p><div class="table-scroll"><table class="v15-table"><thead><tr><th>研究员</th><th>窗口</th><th>主区</th><th>后区</th></tr></thead><tbody>'+Object.entries(report.sensitivity).flatMap(([mode,vals])=>vals.map(v=>'<tr><td>'+E(MODE_LABELS[mode])+'</td><td>'+v.window+'</td><td>'+v.main.map(pad).join(' ')+'</td><td>'+v.extra.map(pad).join(' ')+'</td></tr>')).join('')+'</tbody></table></div></div><p class="footnote">三位研究员都不拥有经独立验证的开奖预测优势。同一彩种的不同有效单式拥有相同一等奖概率；复式与更多不同单式的概率提升来自注数，成本同步上升。</p>';
}
function render(){status();renderFacts();if(report&&oldKey!==keyOf(ctx())){report=null;lastBacktest=null;$('v15Picks').innerHTML='<p class="sub">彩种、历史数据或参数已改变，请点击“生成三位研究员的本期报告”重新生成。</p>';$('v15BacktestResult').textContent='';}}
function run(){try{ensureReport();render();renderPicks();$('v15Run').textContent='已生成本期研究报告（可重新生成）'}catch(e){$('v15Picks').textContent='无法生成：'+e.message}}
function textReport(){const r=ensureReport();return `${r.game==='ssq'?'双色球':'大乐透'} · 基准${r.baseIssue}期 · ${r.policy}\n`+r.picks.map(p=>`${MODE_LABELS[p.mode]}\n单式 ${fmt(p.single)}\n复式 ${fmt(p.compound)}（${p.compound.bets}注/${p.compound.cost}元）`).join('\n\n')+'\n历史统计评分不等于下一期开出概率。'}
function copy(){try{const content=textReport();if(navigator.clipboard?.writeText)navigator.clipboard.writeText(content).then(()=>{$('v15Run').textContent='号码已复制'}).catch(()=>alert('复制失败，请使用导出JSON或长按号码复制'));else alert('浏览器不支持快捷复制，请使用导出JSON')}catch(e){alert(e.message)}}
function importCoverage(){try{const r=ensureReport(),txt=r.picks.map(x=>fmt(x.single)).join('\n');
 const el=$('oddsPaste');if(!el)throw Error('一等奖去重页面未加载');el.value=txt;
 // Budget-conscious: only the three single picks, never auto-add 3 compound tickets.
 document.querySelector('[data-page="coverage"]')?.click();$('oddsImport')?.click();
 $('oddsStatus').textContent+='；V15仅导入三注单式，没有自动扩大投注预算。';
 }catch(e){alert('导入失败：'+e.message)}}
function download(file,text){const blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportJSON(){try{const r=ensureReport();const f={...r,exportedAt:new Date().toISOString(),note:'本机即时研究候选；导出不是GitHub提前锁定证明'};download(`双彩V15_多窗口研究_${r.game}_${r.baseIssue}.json`,JSON.stringify(f,null,2))}catch(e){alert(e.message)}}
function runBacktest(){const c=ctx();if(c.rows.length<310){$('v15BacktestResult').textContent='回测需要足够多的真实历史开奖记录';return}
 $('v15BacktestResult').textContent='正在按时间顺序计算，请勿切换页面……';
 setTimeout(()=>{try{const t=Date.now(),r=backtestV15(c.rows,c.game,{train:Number($('v15Train').value),test:Number($('v15Test').value),window:Number($('v15Primary').value)});lastBacktest=r;
 const fmt=(x)=>Number(x).toFixed(3);$('v15BacktestResult').innerHTML=`<p class="small">${E(r.policy)} · 历史滚动${r.actual}期，训练期数${r.train}，截止${E(r.asOf)} · 计算耗时${((Date.now()-t)/1000).toFixed(1)}秒</p><div class="table-scroll"><table class="v15-table"><thead><tr><th>策略</th><th>主区平均</th><th>后区平均</th><th>等量随机主区</th><th>等量随机后区</th><th>每期总差</th><th>探索性区间</th></tr></thead><tbody>${Object.entries(r.summary).map(([mode,x])=>`<tr><td>${E(MODE_LABELS[mode])}</td><td>${fmt(x.avgMain)}</td><td>${fmt(x.avgExtra)}</td><td>${fmt(x.baseMain)}</td><td>${fmt(x.baseExtra)}</td><td>${x.difference>0?'+':''}${fmt(x.difference)}</td><td>[${fmt(x.CI[0])}, ${fmt(x.CI[1])}]</td></tr>`).join('')}</tbody></table></div><p class="footnote">${E(r.disclaimer)} 样本用于开发过策略，不作为独立证据；不得把研究评分转换为下一期中奖概率。</p>`;
 }catch(e){$('v15BacktestResult').textContent='历史回测失败：'+e.message}},60)}
function init(){if(!$('v15Run'))return;
 window.renderV15Research=render;
 $('v15Run').addEventListener('click',run);$('v15Part').addEventListener('change',render);
 $('v15Primary').addEventListener('change',()=>{report=null;oldKey='';render()});
 $('v15Copy').addEventListener('click',copy);$('v15ImportCoverage').addEventListener('click',importCoverage);
 $('v15Export').addEventListener('click',exportJSON);$('v15Backtest').addEventListener('click',runBacktest);
 document.querySelector('[data-page="insights"]')?.addEventListener('click',render);
 render();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
