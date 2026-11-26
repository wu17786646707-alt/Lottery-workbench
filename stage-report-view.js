import {jointCard} from './joint-view.js';
const modes=['analyst','veteran','trend'],names=['A 数据','B 经验','C 走势'];
const fmt=a=>a.map(n=>String(n).padStart(2,'0')).join(' ')||'—';
const ticket=p=>fmt(p.main)+' ＋ '+fmt(p.extra);
export const ruleText='先算近30期频次，再算近10期相对前10期的次数变化，两项各自排名。A、B、C 的频次／走势权重为 55/45、50/50、35/65，折为百分位分。取主区前23、副区前6；同分先取小号。主区从23缩至15，再缩至复式和单式，每加一枚都按综合分扣除三区、奇偶与近30期占比的偏差，三区按 11/22 或 12/24 分界，B 形态权重较大。副区按排名从6留4，再到2或3，最后留1或2。';
export const goldText='15码池各区第一名须同时满足频次排名前10、短期次数增长、区内领先第二名至少0.04分。通常取最多两区；三区第一都在频次前6且近10期次数比前10期至少多2次时才取三胆。无符合者空胆。金胆先进入复式及单式，复式按全部组合计注。';
function row(d,m,j){
  const a=d.audit[m],ps=[a.outer,...d.byMode[m]],gold=a.gold.filter(n=>d.main.includes(n));
  return '<tr><th>'+names[j]+'</th>'+ps.map(p=>'<td>'+p.hits.join('＋')+'</td>').join('')+'<td>'+gold.length+'/'+a.gold.length+'</td></tr>';
}
function details(d,m,j){
  const a=d.audit[m],ps=[a.outer,...d.byMode[m]],labels=['23码','15码','复式','单式'];
  const nums=ps.map((p,i)=>'<p>'+labels[i]+'　'+ticket(p)+'<br><small>当期命中　'+ticket({main:p.main.filter(n=>d.main.includes(n)),extra:p.extra.filter(n=>d.extra.includes(n))})+'</small></p>').join('');
  return '<details><summary>'+names[j]+' · 逐球、金胆和对照</summary>'+nums+'<p>金胆 '+fmt(a.gold)+'，命中 '+fmt(a.gold.filter(n=>d.main.includes(n)))+'。强制留胆相较无胆单式挤出 '+fmt(a.noGold[1].main.filter(n=>!ps[3].main.includes(n)))+'。</p><p>无胆复式／单式 '+a.noGold.map(t=>ticket(t)+'（中 '+t.hits.join('＋')+'）').join(' ／ ')+'。跳过23码后的单式 '+ticket(a.direct)+'（中 '+a.direct.hits.join('＋')+'）。原流程同规格复式／单式 '+a.old.map(p=>p.hits.join('＋')).join(' ／ ')+'。</p><p>近30期三区占比 '+a.shares.map(n=>(n*100).toFixed(1)+'%').join('／')+'。</p><details><summary>核对23码入围边界和全体主区排名</summary><p>依次为号码、频次名次、走势名次、综合分。第23行是入围线。</p>'+a.facts.map((f,i)=>(i+1)+'　'+f.join('　')).join('<br>')+'</details></details>';
}
export function renderReport(games){
  return ['ssq','dlt'].map(g=>'<section><h2>'+(g==='ssq'?'双色球':'大乐透')+'</h2>'+games[g].draws.map(d=>'<article><h3>'+d.issue+' 期 · '+d.date+'</h3><p>开奖 '+ticket(d)+' · 历史截至 '+d.base+'</p>'+(d.joint?jointCard({id:'历史模拟-'+d.issue,game:g,baseIssue:d.base,targetDate:d.date,status:'settled',actual:d,joint:d.joint}):'')+'<h4>A/B/C 独立对照</h4><table><thead><tr><th>研究员</th><th>23码</th><th>15码</th><th>复式</th><th>单式</th><th>胆中/选</th></tr></thead><tbody>'+modes.map((m,j)=>row(d,m,j)).join('')+'</tbody></table>'+modes.map((m,j)=>details(d,m,j)).join('')+'</article>').join('')+'</section>').join('');
}
