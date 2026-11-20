import {positionScore,aggregate} from './position-study.js';
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
const db={},state={view:'author',caseId:'manuscript',positionDate:'',game:'ssq',mode:'veteran',date:'',show:true,sample:'replay'};
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
function revealButton(){
 return '<button class="toggle" id="reveal" aria-pressed="'+state.show+'">'+(state.show?'隐藏开奖，单看选号':'显示开奖，核对每一步')+'</button>';
}
function manuscript(){
 const actual=state.show?{main:[3,9,16,20,25,30],extra:[5]}:null;
 const line=(title,numbers,verdict)=>'<h3>'+title+'</h3><p>'+esc(numbers)+'</p>'+(actual?note(verdict):'');
 return hero('11 月 10 日手稿 · 对照双色球 2026129 期','大底、四金胆与独立补位','按截图可见文字重建。红圈与 11 月 10 日开奖结果相符，原始发稿时间未知，最终完整票面未展示。')+
 revealButton()+card('趋势、大底与金胆',
 line('趋势观察','02、14、19、26、30','开出 30。它没有进入大底，但作者在凤尾组再次选中了它。')+
 line('大底 · 去重后 14 红','03、04、09、12、14、15、16、18、20、21、23、24、31、32','覆盖 03、09、16、20。原稿把 18 同时列进奇偶两栏。')+
 line('四金胆','03、15、16、20','命中 03、16、20。由大底缩到四胆时丢掉了 09。')+
 line('冷号防守','08、33，另外提示防 33','两个均未开出。'))+
 card('位置组与二选一',line('三个独立首选','龙头 03/04/05 → 03；中间 14/15/16 → 16；凤尾 30/32/33 → 30。','03 是最小号，30 是最大号，16 排第三。03、16 与金胆重复，只算一次号码命中。')+
 line('四组搭配','03/04、15/16、17/18、30/33。','按“恰好开一个”评，四组中三组符合；按“最多开一个”评，四组都符合。17/18 两个都没出。'))+
 card('蓝球从八个缩到四个',line('围蓝 → 定蓝','01、02、03、04、05、06、08、10 → 02、03、04、05','实开 05，两个阶段都保住。图中没有唯一蓝球。'))+
 (actual?card('开奖核对',balls('ssq',actual,null)+note('25 未出现在截图可见的红球建议里。缺少最终票面，无法核算这一稿的实际奖金。')+'<a href="https://www.swlc.net.cn/lottery/ssq.html?limit=30&amp;view=previous">上海福彩开奖公告</a>'):'');
}
function sourceLink(url,label){return '<a href="'+esc(url)+'">'+esc(label)+'</a>';}
function articles(){
 const xiaLinks=[['https://sports.sina.com.cn/l/2026-11-10/doc-iniyfkmh9404668.shtml','129 期'],['https://sports.sina.com.cn/l/2026-11-11/doc-iniyitse8549296.shtml','130 期'],['https://sports.sina.com.cn/l/2026-11-15/doc-iniyupui2182676.shtml','131 期']];
 return hero('公开文章 · 2026 年 11 月','哪些写法值得跟踪','按文章标示的发布时间、实际号码与官方开奖核对。入选依据是可以复算，不按作者自报的奖金排名。')+
 card('夏师傅｜连续记录四胆','<p>新浪彩票的双色球 129、130、131 期文章都列出四个红胆。三期实际分别命中 25、16、31，每期一个。129 期还把当期开出的 20、30 列入六个杀号。</p>'+note('可借鉴：固定候选数，连续登记命中数和误杀数，保留普通期次。')+xiaLinks.map(x=>sourceLink(...x)).join(' · '))+
 card('郑容杰｜给每个排序位置一个首选','<p>双色球 133 期文章将第二位定为 10、第三位定为 14。10 开在第二位，14 开在第四位。六个位置首选合计有两个号码开出，仅一个落在指定位置。</p>'+note('可借鉴：分别显示“号码出现”和“位置选准”。')+sourceLink('https://m.55125.cn/ssq/dingdan/20261119_6730093.htm','彩吧网 · 11 月 19 日文章'))+
 card('不二真探｜检查前后区各自损失','<p>大乐透 26132 期的前区从 15 码缩至 6 码，命中从 3 个降为 2 个，删掉了 02。后区从 5 码缩至 3 码时留下 06，丢了 11。</p>'+note('可借鉴：把前区、后区分开记；大池覆盖与最终票面分别核对。')+sourceLink('https://www.518158.cn/dlt/read_352117.html','新版彩吧 · 11 月 18 日文章'))+
 card('官方开奖',sourceLink('https://www.swlc.net.cn/lottery/ssq.html?limit=30&view=previous','上海福彩 · 双色球历史开奖')+' · '+sourceLink('https://api.js-lottery.com/cms/post-148272.html','江苏体彩 · 大乐透 26132 期'));
}
function positionTotals(s,title){
 if(!s?.n)return card(title,'<p>暂无已结算的公开样本。</p>');
 return card(title,'<p>共 '+s.n+' 期；其中 '+s.changed+' 期发生换号。换后红球多中 '+s.better+' 期，少中 '+s.worse+' 期，持平 '+s.tie+' 期。</p>'+
 '<table><tr><th>8+1 对照</th><th>累计红球</th><th>累计蓝球</th></tr>'+[['原票',s.before,s.blue],['位置补位',s.after,s.blue],['同预算随机',s.randomHits,s.randomBlue]].map(a=>'<tr>'+a.map(n=>'<td>'+esc(n)+'</td>').join('')+'</tr>').join('')+'</table>'+
 '<p>龙头、凤尾分别对位 '+s.headExact+'、'+s.tailExact+' 次；始终选 01、33 作为首尾的对照分别为 '+s.fixedHead+'、'+s.fixedTail+' 次。</p>'+
 '<p>四金胆命中 0／1／2／3／4 个的期数依次为 <strong>'+s.hist.join(' / ')+'</strong>。实际共中 '+s.goldHits+' 个；从相同 15 码池随机挑 4 个的条件期望为 '+(s.poolHits*4/15).toFixed(1)+' 个。</p>'+
 '<p>独立蓝球试验从 8 个缩到 4 个、再到 1 个，分别覆盖 '+s.blueSteps.join(' / ')+' 期。</p>');
}
function viewPosition(){
 const s=db.selection.positionStudy;
 if(!s){$('filters').innerHTML='';return note('本期补位试验尚未生成，请在数据任务完成后刷新。');}
 const locks=s.locks.slice().sort((a,b)=>b.targetDate.localeCompare(a.targetDate));
 const records=db.research.records.filter(r=>r.game==='ssq');
 const drawFor=l=>records.find(r=>r.targetDate===l.targetDate&&r.baseIssue===l.trial.baseIssue&&r.status==='settled')?.actual;
 let header=hero('双色球 · B 经验研究员','龙头与凤尾补位','两组都用 8 红 1 蓝、28 注、56 元。用同一个蓝球，单独比较换红球的效果。');
 const selected=locks.find(l=>l.targetDate===state.positionDate)??locks[0];
 $('filters').innerHTML=locks.length?'<div class="filters">'+select('positionDate','开奖前锁定记录',Object.fromEntries(locks.map(l=>[l.targetDate,l.targetDate+' · '+(drawFor(l)?.issue??pendingLabel(l))])),selected.targetDate)+'</div>':'';
 if(selected){
  const t=selected.trial,draw=drawFor(selected);
  header+=card('目标开奖日 '+selected.targetDate,'<p>依据 '+esc(t.windowEnd)+' 至 '+esc(t.baseIssue)+' 期。北京时间 '+esc(new Date(selected.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}))+' 单独锁定。</p>'+
    t.aims.map(a=>'<p><strong>'+a.role+' '+pad(a.number)+'</strong> · 近 30 期在该位置出现 '+a.count+' 次。'+(a.dropped?'从池外补入，换出 '+pad(a.dropped)+'。':t.base.includes(a.number)?'已在原票中。':'已在初选池中，本规则不补入。')+'</p>').join('')+
    '<p>四金胆 · '+list(t.gold)+(draw?'。开出 '+list(t.gold.filter(n=>draw.main.includes(n))):'')+'</p>'+
    (draw?note('本期实际龙头 '+pad(Math.min(...draw.main))+'，凤尾 '+pad(Math.max(...draw.main))+'。'):''));
  header+=stage('ssq','原 B 池内复式',{main:t.base,extra:[t.blue]},draw,'8+1')+stage('ssq','补位对照票',{main:t.revised,extra:[t.blue]},draw,'8+1',{main:t.base,extra:[t.blue]})+
    card('独立蓝球缩号',t.blueStages.map((p,i)=>'<p>'+['围八','缩四','定一'][i]+' · '+list(p)+(draw?(p.includes(draw.extra[0])?' · 命中':' · 未中'):'')+'</p>').join('')+'<small>按近 30 期频次从高到低，同频小号优先。这三层独立观察，补位对照的两张票共用原蓝球。</small>');
 }else header+=note('待首条开奖前公开锁定。');
 const live=locks.filter(l=>drawFor(l)).map(l=>positionScore(l.trial,drawFor(l)));
 return header+positionTotals(aggregate(live),'公开锁定 · 到期核对')+positionTotals(s.replay,'近 30 期历史回放 · '+s.replay.first+'—'+s.replay.last)+
 card('规则怎样固定','<p>取此前 30 期中最常见的最小号与最大号，同频分别取较小、较大号码。首选在 B 的 15 红池外才补入，先龙头后凤尾；优先换出原 8 红中出现最少的号码，同频先换较大的。保护两个位置首选和四个金胆。</p><p>四金胆取 15 红池中近 30 期出现最多的四个，同频小号优先。它是工作台此次固定的实验规则，手稿没有公开逐球算法。</p>');
}

function viewAuthor(){
 $('filters').innerHTML='<div class="filters">'+select('caseId','案例与文章来源',{manuscript:'11 月 10 日 · 手稿与四金胆',original:'11 月 19 日 · 大复式缩号',articles:'公开文章 · 三位作者核对'},state.caseId)+'</div>';
 if(state.caseId==='manuscript')return manuscript();
 if(state.caseId==='articles')return articles();
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
 if(state.view==='positions'){$('content').innerHTML=viewPosition();return;}
 const rec=makeFilters();
 $('content').innerHTML=state.view==='work'?work(rec):state.view==='compare'?comparisons():roads(rec);
}
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-view]');
 if(tab){state.view=tab.dataset.view;render();}
 if(e.target.id==='reveal'){state.show=!state.show;render();}
});
$('filters').addEventListener('change',e=>{const k=e.target.id;if(['game','mode','date','sample','caseId','positionDate'].includes(k)){state[k]=e.target.value;if(k==='game')state.date='';render();}});
render();
await Promise.all(Object.entries({research:'research.json',selection:'selection-data.json',history:'history.json'}).map(async ([k,url])=>{
 try{const res=await fetch(url,{cache:'no-cache'});if(!res.ok)throw Error();db[k]=await res.json();}catch{db.error=true;}render();
}));
