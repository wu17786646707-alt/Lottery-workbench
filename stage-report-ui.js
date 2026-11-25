import {renderReport,ruleText,goldText} from './stage-report-view.js';
document.getElementById('rules').textContent=ruleText+' '+goldText;
const node=document.getElementById('report');
try {
  const response=await fetch('selection-data.json',{cache:'no-store'});
  if(!response.ok)throw Error();
  node.innerHTML=renderReport((await response.json()).stageReplay);
}catch{node.textContent='回测数据暂未就绪，请稍后刷新。'}
