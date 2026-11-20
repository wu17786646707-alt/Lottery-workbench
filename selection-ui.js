import {roadCounts,roadStats,summary} from './selection-engine.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const list=a=>a.length?a.map(pad).join('、'):'无';
const partNames={ssq:['红球','蓝球'],dlt:['前区','后区']};
const names={ssq:'双色球',dlt:'大乐透'},researchers={analyst:'A 数据研究员',veteran:'B 经验研究员',trend:'C 走势研究员'};
const author={
 game:'ssq',draw:{main:[7,10,11,14,21,26],extra:[13]},
 stages:[{main:[2,4,7,9,10,11,14,16,21,24,25,26,29,30,33],extra:[1,4,8,9,11]},
 {main:[7,9,11,16,21,24,25,33],extra:[4,9]},
 {main:[7,9,11,21,25,33],extra:[9]}]
};
const db={},state={view:'author',game:'ssq',mode:'veteran',date:'',show:true,sample:'replay'};
const card=(title,body)=>'<section class="card"><h2>'+esc(title)+'</h2>'+body+'</section>';
const note=s=>'<p class="note">'+esc(s)+'</p>';
const hero=(label,title,body)=>'<section class="hero"><small>'+esc(label)+'</small><h2>'+esc(title)+'</h2><p>'+esc(body)+'</p></section>';
function balls(game,pick,draw){
 return ['main','extra'].map((k,i)=>'<div class="balls"><span class="part">'+partNames[game][i]+'</span>'+pick[k].map(n=>{
   const hit=draw?.[k]?.includes(n);return '<span class="ball '+k+(hit?' hit':'')+'" aria-label="'+pad(n)+(hit?' 命中':'')+'">'+pad(n)+'</span>';
 }).join('')+'</div>').join('');
}
function stage(game,title,pick,draw,meta='',previous=null){
 let text='';
 if(previous){
   for(const [i,k] of ['main','extra'].entries()){
     const gone=previous[k].filter(n=>!pick[k].includes(n));
     const added=pick[k].filter(n=>!previous[k].includes(n));
     if(gone.length)text+='<p>'+partNames[game][i]+'删去 '+list(gone)+(draw?' · 其中开出 '+list(gone.filter(n=>draw[k].includes(n))):'')+'</p>';
     if(added.length)text+='<p>'+partNames[game][i]+'新增 '+list(added)+(draw?' · 其中开出 '+list(added.filter(n=>draw[k].includes(n))):'')+'</p>';
   }
 }
 const hits=draw?['main','extra'].map(k=>pick[k].filter(n=>draw[k].includes(n)).length).join('+'):'';
 return '<article class="stage"><header><h3>'+esc(title)+'</h3><small>'+esc(meta)+'</small></header>'+balls(game,pick,draw)+(draw?'<strong>命中 '+hits+'</strong>':'')+(text?'<div class="muted">'+text+'</div>':'')+'</article>';
}
function viewAuthor(){
 $('filters').innerHTML='';
 const actual=state.show?author.draw:null;
 const rules=[['跨度','比较近期周四走势，判断跨度会从 16 回升，落在 26 左右。','实际 19，方向吻合，幅度偏小。'],
 ['重号','预期本期没有与上期重复的红球。','21 连续两期开出。'],
 ['和尾','用近 15 个周四观察和值个位数，关注从 3 向 6 附近上移。','红球和值 89，和尾为 9。'],
 ['蓝球','取过去十年的第 133 期，结合冷热和 012 路，从五个蓝球中重点选温号 09。','实开 13，余 1。五个备选也没有覆盖 13。']];
 return hero('作者「坚持就是胜利」 · 双色球 2026133 期','从 15+5 到一张单式','按分享截图还原选号顺序。原文公开了形态判断和三档号码，逐球删留的理由、原始发布时间未展示。')+
 '<button class="toggle" id="reveal" aria-pressed="'+state.show+'">'+(state.show?'隐藏开奖，单看选号':'显示开奖，核对每一步')+'</button>'+
 card('作者先看什么',rules.map(([k,v,e])=>'<h3>'+k+'</h3><p>'+v+'</p>'+(actual?'<p class="muted">核对 · '+e+'</p>':'')).join(''))+
 author.stages.map((p,i)=>stage('ssq',['大复式 · 15+5','缩到 8+2','最终单式 · 6+1'][i],p,actual,['25,025 注 · 50,050 元','56 注 · 112 元','1 注 · 2 元'][i],author.stages[i-1])).join('')+
 (actual?card('奖金落在哪一档',balls('ssq',actual,null)+note('15+5 的理论奖金为 845,460 元；8+2 和 6+1 均为 0 元。页面按推荐组合计算，实际出票与兑奖情况未知。')+
 '<p class="muted">截图把 01 写为 0 路。按号码除以 3 的余数，01 属 1 路。上期 09 也没有与前一期重复。</p><a href="https://www.gxcaipiao.com.cn/notice/detail/ssq/2026133.html">查看当期开奖公告</a>'):'');
}
function select(id,title,options,value){
 return '<label class="wide">'+esc(title)+'<select id="'+id+'">'+Object.entries(options).map(([k,v])=>'<option value="'+esc(k)+'"'+(k===value?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
}
const sortedRecords=()=>db.research.records.filter(r=>r.game===state.game).sort((a,b)=>b.targetDate.localeCompare(a.targetDate));
function pendingLabel(r){
 const time=Date.parse(r.targetDate+'T22:00:00+08:00');
 return Date.now()>=time?'待同步核对':'待开奖';
}
function makeFilters(){
 const records=sortedRecords();
 if(!records.some(r=>r.targetDate===state.date))state.date=records[0]?.targetDate??'';
 const opts=Object.fromEntries(records.map(r=>[r.targetDate,r.targetDate+' · '+(r.actual?.issue??pendingLabel(r))]));
 let s=select('game','彩种',names,state.game);
 if(state.view!=='compare')s+=select('date','目标开奖日',opts,state.date);
 if(state.view!=='roads')s+=select('mode','研究员',researchers,state.mode);
 if(state.view==='compare')s+=select('sample','证据类型',{replay:'最近 30 期历史回放',public:'开奖前公开锁定'},state.sample);
 $('filters').innerHTML='<div class="filters">'+s+'</div>';
 return records.find(r=>r.targetDate===state.date);
}
function work(r){
 if(!r)return note('该彩种还没有公开选号记录。');
 const {game,mode}=state,actual=r.actual;
 const lock=db.selection.locks.find(l=>l.game===game&&l.targetDate===r.targetDate);
 const legacy=r.picks?.find(p=>p.mode===mode),budget=r.compoundPicks?.find(p=>p.mode===mode);
 let s=hero(names[game]+' · '+r.targetDate,actual?'已开奖 · 第 '+actual.issue+' 期':'开奖前记录 · '+pendingLabel(r),'依据第 '+r.baseIssue+' 期及更早数据。'+(actual?'实心号码表示命中。':'开奖结算后显示每一步删去和保留的中奖号码。'));
 if(actual)s+=card('本期开奖',balls(game,actual,null));
 if(lock){
  const t=lock.byMode[mode],sizes=game==='ssq'?['15+5','8+1','6+1']:['13+5','7+2','5+2'];
  s+=card('号码池缩号试验','<p>按'+esc(researchers[mode])+'的逐球分排出初选池，同分按号码升序。在池内比较 360 组单式的形态与逐球分，保留得分最高的一组，再补两个主区号形成预算复式。下列三档按覆盖范围展示。</p><small>北京时间 '+esc(new Date(lock.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}))+' 锁定</small>')+
    t.stages.map((p,i)=>stage(game,['初选池','预算内复式','最终单式'][i]+' · '+sizes[i],p,actual,['仅观察',game==='ssq'?'28 注 · 56 元':'21 注 · 42 元','1 注 · 2 元'][i],t.stages[i-1])).join('');
 }else s+=note('这一期只保留了原策略的记录。以下展示当时实际保存的选号阶段。');
 if(legacy){
   s+=card('原策略 · 单式扩到复式','<p>'+esc(legacy.shapePlan?.reason??legacy.summary??researchers[mode])+'</p>');
   s+=stage(game,'单式',legacy,actual,'1 注 · 2 元');
   if(budget)s+=stage(game,'扩号后的复式',budget,actual,budget.bets+' 注 · '+budget.cost+' 元',legacy);
   if(legacy.softKills)s+=card('当期软杀号',balls(game,legacy.softKills,actual)+(actual?note('染色号码是被降权后实际开出的号码。'):''));
 }
 return s;
}
function comparisons(){
 const {game,mode,sample}=state;const replay=db.selection.replay[game];
 const records=new Map(sortedRecords().filter(r=>r.actual).map(r=>[r.targetDate,r]));
 const locks=db.selection.locks.filter(r=>r.game===game);
 const finished=locks.filter(l=>records.has(l.targetDate));
 const d=sample==='replay'?replay?.byMode[mode]:summary(finished.map(l=>({trial:l.byMode[mode],draw:records.get(l.targetDate).actual})));
 const budget=game==='ssq'?'8+1 · 28 注 / 56 元':'7+2 · 21 注 / 42 元';
 let s=hero(names[game]+' · '+researchers[mode],budget,sample==='replay'?'每个目标期仅取此前 300 期作训练。区间 '+(replay?.firstIssue??'—')+' 至 '+(replay?.baseIssue??'—')+'。':'开奖前归档 '+locks.length+' 期，已核对 '+finished.length+' 期。');
 if(!d?.n)return s+note('尚无已开奖的公开对照样本，开奖并同步后即可查看。');
 const labels={base:'原策略 · 软杀开',off:'原策略 · 软杀关',road:'软杀开 + 012 路',random:'同预算随机'};
 const parts=partNames[game];
 s+=card(d.n+' 期 · 每期平均命中数','<table><thead><tr><th>组别</th><th>'+parts[0]+'</th><th>'+parts[1]+'</th></tr></thead><tbody>'+Object.entries(labels).map(([k,v])=>'<tr><td>'+v+'</td>'+d.rows[k].map(n=>'<td>'+(n/d.n).toFixed(2)+'</td>').join('')+'</tr>').join('')+'</tbody></table>');
 s+=card('软杀号的实际影响','<p>降权名单累计碰到开奖号码 '+d.wrong[0]+' 个'+parts[0]+'、'+d.wrong[1]+' 个'+parts[1]+'。</p><p>逐期比较开与关，开启后少中的合计为 '+d.lost.join(' + ')+' 个；多中的合计为 '+d.gained.join(' + ')+' 个（'+parts.join(' / ')+'）。</p>');
 return s+card('怎么比','<p>前三组使用同一训练窗口、随机种子、候选组合和注数。关闭软杀只移除降权；012 路组在原策略上轻微增加近 30 期占比低于理论值的路数权重。随机组按同一票型在全号域抽取。</p><small>这四组独立于号码池缩号试验。均值描述历史命中，无法据此推断下一期中奖概率。</small>');
}
function roads(r){
 if(!r)return note('还没有可用的目标期。');
 const history=db.history[state.game], pos=history.findIndex(x=>x.issue===r.baseIssue);
 if(pos<0||history.length-pos<30)return note('该基准期缺少完整的 30 期历史。');
 const stats=roadStats(history.slice(pos,pos+30),state.game);
 let s=hero(names[state.game]+' · 目标 '+r.targetDate,'开奖前 30 期的 012 路','基准期 '+r.baseIssue+'。将号码除以 3，用余数 0、1、2 分组。理论占比按各路可选号码数量计算。');
 for(const [i,k] of ['main','extra'].entries()){
   const a=stats[k],total=a.groups.flat().length;
   s+=card(partNames[state.game][i]+'分布','<table><thead><tr><th>路数</th><th>球次</th><th>近 30 期</th><th>理论</th></tr></thead><tbody>'+a.groups.map((g,j)=>'<tr><td>'+j+' 路</td><td>'+a.counts[j]+'</td><td>'+(100*a.counts[j]/a.total).toFixed(1)+'%</td><td>'+(100*g.length/total).toFixed(1)+'%</td></tr>').join('')+'</tbody></table><details><summary>逐号查路数</summary>'+a.groups.map((g,j)=>'<p>'+j+' 路 · '+list(g)+'</p>').join('')+'</details>'+(r.actual?note('当期开出 '+list(r.actual[k])+'，路比 '+roadCounts(r.actual[k]).join('∶')+'。'):''));
 }
 const tickets=r.compoundPicks?.filter(p=>researchers[p.mode])??[];
 if(tickets.length)s+=card('当期预算复式的路比','<table><tr><th>研究员</th><th>'+partNames[state.game][0]+'</th><th>'+partNames[state.game][1]+'</th></tr>'+tickets.map(p=>'<tr><td>'+esc(researchers[p.mode])+'</td><td>'+roadCounts(p.main).join('∶')+'</td><td>'+roadCounts(p.extra).join('∶')+'</td></tr>').join('')+'</table>');
 return s;
}
function render(){
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
 if(state.view==='author'){$('content').innerHTML=viewAuthor();return;}
 if(!db.selection||!db.research||(state.view==='roads'&&!db.history)){
   $('filters').innerHTML='';$('content').innerHTML=note(db.error?'本次未能取得完整数据，请重新加载。':'正在读取公开记录…');return;
 }
 const rec=makeFilters();
 $('content').innerHTML=state.view==='work'?work(rec):state.view==='compare'?comparisons():roads(rec);
}
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-view]');
 if(tab){state.view=tab.dataset.view;render();}
 if(e.target.id==='reveal'){state.show=!state.show;render();}
});
$('filters').addEventListener('change',e=>{const k=e.target.id;if(['game','mode','date','sample'].includes(k)){state[k]=e.target.value;if(k==='game')state.date='';render();}});
render();
await Promise.all(Object.entries({research:'research.json',selection:'selection-data.json',history:'history.json'}).map(async ([k,url])=>{
 try{const res=await fetch(url,{cache:'no-cache'});if(!res.ok)throw Error();db[k]=await res.json();}catch{db.error=true;}render();
}));
