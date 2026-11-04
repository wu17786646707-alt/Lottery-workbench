/* V17.2.1: 启动救援，模块无法及时运行时仍能看到真实开奖记录。禁止构造或虚构开奖号码。 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const pad=n=>String(n).padStart(2,'0');
 function balls(main,extra){return '<div class="balls">'+main.map(n=>'<span class="ball">'+pad(n)+'</span>').join('')+extra.map(n=>'<span class="ball extra">'+pad(n)+'</span>').join('')+'</div>'}
 let finished=false;
 async function rescue(){
  const status=$('appRecoveryBanner');if(!status||finished)return;
  const current=Number($('metricCount')?.textContent?.replaceAll(',',''))||0;
  if(current>=20){finished=true;status.hidden=true;return;}
  status.hidden=false;status.textContent='开奖记录还没有加载到页面，正在从本仓库直接恢复。无需清除 Safari 缓存或本机研究记录。';
  try{
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),23000);
   let response;try{response=await fetch('./history.json?recover='+Date.now(),{cache:'no-store',signal:ctl.signal})}finally{clearTimeout(timer)}
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();if(!Array.isArray(data.ssq)||!Array.isArray(data.dlt))throw Error('历史文件格式异常');
   const valid=g=>(data[g]||[]).filter(x=>{const k=g==='ssq'?6:5,e=g==='ssq'?1:2,n=g==='ssq'?33:35,m=g==='ssq'?16:12;return x&&/^20\d{5}$/.test(x.issue||'')&&/^20\d{2}-\d{2}-\d{2}$/.test(x.date||'')&&[x.main,x.extra].every(Array.isArray)&&x.main.length===k&&x.extra.length===e&&new Set(x.main).size===k&&new Set(x.extra).size===e&&x.main.every(v=>Number.isInteger(v)&&v>=1&&v<=n)&&x.extra.every(v=>Number.isInteger(v)&&v>=1&&v<=m)}).sort((a,b)=>String(b.issue).localeCompare(String(a.issue)));
   const by={ssq:valid('ssq'),dlt:valid('dlt')};
   if(!by.ssq.length&&!by.dlt.length)throw Error('暂无有效历史记录');
   // 仅当主应用未加载真实数据时启动独立降级显示；不修改 IndexedDB、守号、研究员和存储。
   const mainHas=Number($('metricCount')?.textContent?.replaceAll(',',''))||0;
   if(mainHas>=20){finished=true;status.hidden=true;return}
   const game=document.querySelector('[data-game].active')?.dataset.game||'ssq';const list=by[game],first=list[0];
   if(!first)throw Error('当前彩种尚无历史数据');
   $('topCount').textContent=list.length+' 期';$('latestIssue').textContent='已开奖 '+first.issue;
   $('metricCount').textContent=String(list.length);$('metricIssue').textContent=first.issue;$('metricDate').textContent=first.date;
   $('latestInfo').textContent=first.issue+' 期 · '+first.date;
   $('latestBalls').innerHTML=balls(first.main,first.extra);
   $('latestVerify').textContent='来自仓库历史快照，待独立核验';
   const box=$('historyList');if(box)box.innerHTML=list.slice(0,30).map(r=>'<div class="item"><strong>'+r.issue+'期 · '+r.date+'</strong>'+balls(r.main,r.extra)+'</div>').join('');
   $('issueContextPanel').textContent='已从 GitHub 本仓库恢复历史开奖的只读预览。完整走势图及研究模块仍须加载主程序，请不要把此预览当作下一期预测。';
   status.textContent='已恢复真实开奖和最近30期的只读预览（'+list.length+'期）。主程序未完全初始化，可点击右上角“同步”尝试完整恢复。若按钮无响应，请上传此修复包后用新网址打开。';
  }catch(e){status.textContent='开奖记录暂未加载：'+String(e.message||e)+'。请检查网络后刷新，或先查看 GitHub 仓库 history.json；数据没有被删除。';}
 }
 window.addEventListener('load',()=>setTimeout(rescue,5500));
})();
