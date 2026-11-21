import {GAMES, numsText, pad, escapeHTML as esc, mergeDraws} from './core.js?v=18.0';
import {issueContext, fmtTarget, statusText} from './issue-context.js?v=18.0';
import {methods, forecast, backtest, usablePair, usableTarget} from './trajectory.js';

const $=id=>document.getElementById(id);
const fields=['main','extra'];
const rowsByGame={}, provenance={};
let locks=[], archiveAvailable=false, current=null;
const details=(title,content)=>'<details><summary>'+title+'</summary>'+content+'</details>';
const card=(title,content)=>'<section class="card"><h2>'+title+'</h2>'+content+'</section>';
const pct=(a,b)=>b?(100*a/b).toFixed(2)+'%':'—';
const num=a=>a.toLocaleString('zh-CN');
const balls=a=>numsText(a)||'无';
const table=(heads,rows)=>'<div class="hscroll"><table><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const hits=(a,b)=>a.filter(n=>b.includes(n));
const rowTitle=(g,r)=>'第 '+(g==='dlt'?r.issue.slice(2):r.issue)+' 期';
const opt=(value,label)=>new Option(label,value);

function plot(path,bases,target) {
  const v=path.points,r=path.rule;
  let points;
  if(r==='triangle') points=[[v[0],1],[v[1],1],[target,2],[v[0],1]];
  else if(r==='star') points=[[v[0],0],[v[3],1],[v[2],1],[v[1],0],[target,2],[v[0],0]];
  else points=v.map((n,i)=>[n,i]);
  const numbers=points.map(p=>p[0]),min=Math.min(...numbers),max=Math.max(...numbers);
  const x=n=>87+(n-min)*Math.min(40,212/Math.max(1,max-min)),y=i=>18+i*29;
  let svg=[bases[0].issue.slice(-3)+'期',bases[1].issue.slice(-3)+'期','目标期'].map((s,i)=>'<text x="9" y="'+(y(i)+4)+'">'+s+'</text>').join('');
  for(let i=1;i<points.length;i++) {
    const [n,a]=points[i-1],[m,b]=points[i];
    svg+='<line class="'+(Math.max(a,b)===2?'next':'past')+'" x1="'+x(n)+'" y1="'+y(a)+'" x2="'+x(m)+'" y2="'+y(b)+'"/>';
  }
  for(const [i,[n,t]] of points.entries()) {
    if(points.slice(0,i).some(([a,b])=>n===a&&t===b))continue;
    svg+='<circle cx="'+x(n)+'" cy="'+y(t)+'" r="9" fill="'+(t===2?'white':'#d9ede6')+'"/><text text-anchor="middle" x="'+x(n)+'" y="'+(y(t)+4)+'">'+pad(n)+'</text>';
  }
  return '<svg class="trace-plot" viewBox="0 0 330 94" role="img" aria-label="'+methods[r]+'，目标 '+pad(target)+'">'+svg+'</svg>';
}
function explain(field,n) {
  const {pred,bases,actual}=current;
  const entry=pred[field].marks.get(n), isFill=pred[field].fillers.includes(n);
  const parts=entry?.paths.map(path=>{
    const v=path.points;
    const label=path.rule==='triangle'?balls(v.slice(0,2))+' 的中点为 '+pad(n):
      path.rule==='star'?balls(v.slice(0,2))+' 与 '+balls(v.slice(2,4))+' 的星尖为 '+pad(n):v.map(pad).join(' → ');
    return '<p>'+methods[path.rule]+' · '+label+'</p>'+plot(path,bases,n);
  })??[];
  $('reason-'+field).innerHTML='<h3>'+pad(n)+' 的选号依据</h3>'+(parts.join('')||'<p>四种画法均未标出此号码。</p>')+
    (isFill?'<p>单式补号，单列统计。</p>':'')+(actual?'<p>当期核对 · '+(actual[field].includes(n)?'开出':'未开出')+'</p>':'');
  for(const b of $('board-'+field).querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.value)===n));
}
function forecastPanel(game,ctx,actual,base,pred,lock) {
  current={pred,bases:base,actual};
  const cfg=GAMES[game];
  const title=actual?rowTitle(game,actual)+' · '+actual.date:fmtTarget(ctx);
  const heading=lock?'开奖前已留档':actual?'历史逐期重算':'按当前档案推演';
  let html='<section class="hero"><small>'+heading+'</small><h2>'+esc(title)+'</h2>'+
    fields.map(f=>'<p class="numline">'+cfg[f+'Name']+'　'+balls(lock?.saved[f].numbers??pred[f].numbers)+'</p>').join('')+
    '<p>依据 '+base.map(r=>esc(r.issue)).join('、')+' 期。'+(actual?'单式命中 '+fields.map(f=>hits(lock?.saved[f].numbers??pred[f].numbers,actual[f]).length).join(' + ')+'。':'开奖后可在期次列表核对。')+'</p></section>';
  for(const f of fields) {
    const z=pred[f],saved=lock?.saved[f], candidates=saved?.pool??[...z.marks.keys()],fillers=saved?.fillers??z.fillers;
    const selected=[...z.marks].sort((a,b)=>b[1].rules.length-a[1].rules.length || a[0]-b[0])[0]?.[0]??fillers[0]??1;
    const grid=Array.from({length:cfg[f+'Max']},(_,i)=>{
      const n=i+1,c=z.marks.get(n)?.rules.length??0;
      return '<button type="button" value="'+n+'" data-field="'+f+'" aria-pressed="false" aria-label="'+pad(n)+'，'+c+'种画法" class="'+(c>1?'mark multi':c?'mark':'')+'">'+pad(n)+(c?'<sup>'+c+'</sup>':'')+'</button>';
    }).join('');
    html+=card(cfg[f+'Name']+' · '+candidates.length+' 个轨迹候选',
      '<p>轨迹池　'+balls(candidates)+'</p><p>单式补号　'+balls(fillers)+'</p>'+
      (actual?'<p>实际开奖　'+balls(actual[f])+'<br>池内命中　'+balls(hits(candidates,actual[f]))+'</p>':'')+
      '<p class="muted">点号码查看连线。右上角数字为不同画法数，虚线延至目标期。</p>'+
      '<div class="board" id="board-'+f+'">'+grid+'</div><div aria-live="polite" id="reason-'+f+'" data-default="'+selected+'"></div>');
  }
  $('pick').innerHTML=html;
  for(const f of fields)explain(f,Number($('reason-'+f).dataset.default));
}
function metrics(game,rows,end) {
  const cfg=GAMES[game], window=$('window').value==='all'?Infinity:Number($('window').value);
  const a=backtest(game,rows,window,end);
  if(!a.draws){$('metrics').innerHTML=card('历史回测','连续开奖样本不足。'); return;}
  const labels={all:'四种画法并集',multi:'两种以上',...methods,ticket:'最终单式',fillers:'单式中的补号'};
  let body='<p>'+a.first.date+' 至 '+a.last.date+'，有效 '+num(a.draws)+' 期'+(a.skipped?'，跳过 '+a.skipped+' 个缺期样本':'')+'。</p>';
  for(const f of fields) {
    const s=a.stats[f],m=cfg[f+'Count'],N=cfg[f+'Max'];
    body+='<h3>'+cfg[f+'Name']+'</h3>'+table(['范围','命中 / 标记','标记命中率','每期均中'],['all','ticket'].map(k=>[labels[k],s[k].hits+' / '+num(s[k].marks),pct(s[k].hits,s[k].marks),(s[k].hits/a.draws).toFixed(2)]))+
      '<p class="muted">同量随机每个标记命中率 '+pct(m,N)+'。轨迹池每期平均标 '+(s.all.marks/a.draws).toFixed(2)+' 个，至少中一个 '+s.all.any+' 期，整区圈全 '+s.all.full+' 期。</p>'+
      details('逐种画法和补号',table(['画法','命中 / 标记','命中率','同量随机期望命中数'],['multi',...Object.keys(methods),'fillers'].map(k=>[labels[k],s[k].hits+' / '+num(s[k].marks),pct(s[k].hits,s[k].marks),(s[k].marks*m/N).toFixed(1)])));
  }
  body+='<p class="note">两区同时圈全 '+a.poolJackpots+' / '+num(a.draws)+' 期。最终单式两区全中 '+a.ticketJackpots+' / '+num(a.draws)+' 期。</p>'+
    '<p class="muted">每期先用前两期开奖选号，再与当期实际号码求交集。命中率 = 命中个数 ÷ 标记总数；同号多条线在并集中只算一次。各画法之间可以重叠。</p>';
  $('metrics').innerHTML=card('历史回测',body);
}
function archivePanel(game,rows) {
  const own=locks.filter(x=>x.game===game && x.policy==='trajectory-v1');
  const byDate=new Map(rows.map(r=>[r.date,r]));
  const recent=own.slice().sort((a,b)=>b.targetDate.localeCompare(a.targetDate));
  $('archive').innerHTML=card('开奖前留档',recent.length?table(['目标开奖日','开奖前留档（北京时间）','单式命中'],recent.map(l=>{
    const actual=byDate.get(l.targetDate);
    const t=new Date(l.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
    return [esc(l.targetDate),esc(t),actual?fields.map(f=>hits(l.saved[f].numbers,actual[f]).length).join(' + '):'待核对'];
  })):'<p>'+ (archiveAvailable?'当前档案还没有这个彩种的开奖前记录。':'留档文件暂时无法读取。')+'</p>');
}
function render() {
  const game=$('game').value,rows=rowsByGame[game],next=$('target').value==='next';
  const i=next?rows.length:Number($('target').value), actual=next?null:rows[i];
  const ctx=issueContext(game,[rows.at(-1)].filter(Boolean)), date=actual?.date??ctx.targetDate;
  const lock=locks.find(l=>l.game===game && l.targetDate===date && l.policy==='trajectory-v1');
  $('status').textContent=[next?statusText(ctx):'逐期核对',provenance[game]].filter(Boolean).join(' · ');
  if((!next || ctx.canRecommend) && (lock || (next?usablePair(rows,i):usableTarget(rows,i)))) {
    const base=lock?.bases??rows.slice(i-2,i);
    forecastPanel(game,ctx,actual,base,forecast(game,...base),lock);
  }else {$('pick').innerHTML=card('当期选号','请核对最近两期的连续开奖数据和目标日期。');current=null;}
  metrics(game,rows,next?i:i+1);archivePanel(game,rows);
}
function gameChanged() {
  const game=$('game').value,rows=rowsByGame[game];
  const select=$('target');select.replaceChildren(opt('next','下一期'));
  for(let i=rows.length-1;i>=Math.max(2,rows.length-60);i--)select.add(opt(i,rowTitle(game,rows[i])+' · '+rows[i].date));
  render();
}
async function json(path) {
  const r=await fetch(path,{cache:'no-cache'}); if(!r.ok)throw Error('读取失败');return r.json();
}
async function start() {
  const [history,archive]=await Promise.allSettled([json('history.json'),json('selection-data.json')]);
  if(history.status!=='fulfilled')throw Error('开奖记录暂时无法读取，请刷新重试。');
  archiveAvailable=archive.status==='fulfilled';
  locks=(archiveAvailable?archive.value.trajectoryLocks:null)??[];
  for(const game of Object.keys(GAMES)){
    const d=mergeDraws([],history.value[game],game);
    rowsByGame[game]=d.rows.reverse();
    provenance[game]=history.value.provenance?.[game]?.status??'数据来源见工作台数据中心';
  }
  $('pick').addEventListener('click',e=>{const b=e.target.closest('button[data-field]');if(b&&current)explain(b.dataset.field,Number(b.value));});
  $('game').addEventListener('change',gameChanged);$('target').addEventListener('change',render);$('window').addEventListener('change',render);
  gameChanged();
}
start().catch(e=>{$('status').textContent=e.message;});
