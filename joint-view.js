import {outerAudit} from './outer-audit.js';
import {traceHTML,rearRationale,removalDiagnosis} from './shrink-audit.js';
import {escapeHTML} from './core.js';
import {tentativeIssue,recordStage} from './issue-context.js';
const esc=x=>escapeHTML(String(x));
const nums=a=>a.map(n=>String(n).padStart(2,'0')).join(' ')||'—';
const ticket=p=>nums(p.main)+' ＋ '+nums(p.extra);
const labels=['23 码大底','15 码池','联合复式','联合单式'];
export function jointText(rec){
 const j=rec.joint;
 return (rec.game==='ssq'?'双色球':'大乐透')+'　'+rec.targetDate+'　'+(rec.actual?.issue||tentativeIssue(rec.baseIssue,rec.targetDate))+'期\n'+
 '基准 '+rec.baseIssue+'　方案 '+rec.id+'\n'+labels.map((n,i)=>n+'　'+ticket(j.stages[i])).join('\n')+'\n金胆　'+nums(j.gold);
}
export function jointCard(rec){
 if(!rec?.joint)return '<p>当前期次尚无公开联合记录。</p>';
 const j=rec.joint,stages=j.stages,ssq=rec.game==='ssq',actual=rec.actual;
 const header='<p>'+esc(ssq?'双色球':'大乐透')+' · '+esc(rec.actual?.issue||tentativeIssue(rec.baseIssue,rec.targetDate))+' 期 · '+esc(rec.targetDate)+' · 基准 '+esc(rec.baseIssue)+' · 版本 '+esc(rec.revision||1)+'</p>';
 const hit=p=>actual?' · 命中 '+p.main.filter(n=>actual.main.includes(n)).length+'＋'+p.extra.filter(n=>actual.extra.includes(n)).length:'';
 const line=i=>'<p><b>'+labels[i]+'</b>　'+esc(ticket(stages[i]))+hit(stages[i])+'</p>';
 const copy=jointText(rec);
 return '<article class="item">'+header+line(3)+line(2)+'<p>金胆 '+esc(nums(j.gold))+'　'+(ssq?'8＋2 · 56注／112元':'7＋3 · 63注／126元')+'</p>'+
 (actual?'<p>实际开奖　'+esc(ticket(actual))+'</p>':recordStage(rec)==='overdue'?'<p>目标时间已过，待开奖数据核对。</p>':'')+
 outerAudit(j,actual)+rearRationale(j)+(actual?traceHTML(stages,actual)+removalDiagnosis(j,actual):'')+
 '<details><summary>查看 23 → 15 → 复式 → 单式的取舍</summary>'+line(0)+line(1)+
 '<p>A 提供'+(j.gapDepth?'近30期':'近30／120期')+'频次顺位，C 提供近10期相对前10期的趋势顺位。主区按55／45合分。B 用近30期三区、奇偶分布缩至15码。下列两组同区竞争方案由长短两个窗口分别提出，并按两窗口的平均得分选取。</p>'+
 j.proposals.map((a,i)=>'<p>'+['30期','10期'][i]+'结构　'+esc(nums(a))+' · 得分 '+Number(j.merits[i]).toFixed(3)+(i===j.selected?' · 采用':'')+'</p>').join('')+
 '<p>最终在该复式内比较包含金胆的全部主区组合，按逐球合分和近30期三区、奇偶偏差取最高分。副区按频次／走势排序，双色球55／45，大乐透35／65。</p>'+
 '<details><summary>主区和副区逐球入围顺位</summary>'+[j.evidence,j.rearEvidence].map((rows,k)=>'<h4>'+['主区','副区'][k]+'</h4><p>每行依次为排名、号码、近30期次数、短期次数变化、频次名次、趋势名次、综合分。'+(j.gapDepth?'末两列为近10期次数与连续遗漏期数。':'')+'</p>'+rows.map((r,i)=>esc([i+1,...r.map((v,k)=>k===7&&v===j.gapDepth?'≥'+v:v)].join('　'))).join('<br>')).join('')+'</details></details>'+
 '<details><summary>复制或导出本版联合记录</summary><p><button type="button" data-joint-copy>复制号码</button> <button type="button" data-joint-export>导出文本</button></p><pre data-joint-text style="white-space:pre-wrap">'+esc(copy)+'</pre><small role="status"></small></details></article>';
}
if(typeof document!=='undefined')document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-joint-copy],[data-joint-export]');if(!btn)return;
 const panel=btn.closest('details'),text=panel.querySelector('[data-joint-text]').textContent,status=panel.querySelector('[role="status"]');
 if(btn.hasAttribute('data-joint-copy')){
   try{await navigator.clipboard.writeText(text);status.textContent='已复制本版联合记录。';}catch{status.textContent='请长按下方原文复制。';}
 }else{
   const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');
   a.href=url;a.download='联合选号-'+text.split('\n')[0].replace(/\s+/g,'-')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
});
