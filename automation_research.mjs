#!/usr/bin/env node
/**
 * Public, deterministic A/B/C research log. This does not upload private iPhone records.
 * Runs in GitHub Actions BEFORE the target drawing, and commits predictions to Git history.
 * No prediction is invented for past draws. Historical backtests remain separate.
 */
import fs from 'node:fs';
import {hit, scoreLabel, compoundHit, historicPatterns} from './engine.js';
import {pickV15,makeCompoundV15,MW_POLICY} from './multiwindow.js';
import {GAMES, POLICY, hash} from './core.js';

const HISTORY='history.json', OUTPUT='research.json', HEALTH='health.json';
const SCHEDULE={ssq:[0,2,4],dlt:[1,3,6]}; // UTC weekday for Beijing calendar date (Sun=0); holidays excluded
const MODES=['analyst','veteran','trend','random'];
const briefShape=p=>p?{target:p.target,reason:p.reason,empirical:{sample:p.empirical?.sample,commonZones:p.empirical?.commonZones?.slice(0,3)}}:null;
const CN_DATE=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
function cndate(at){const p=CN_DATE.formatToParts(at);const m=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`;}
function weekday(day){return new Date(day+'T12:00:00Z').getUTCDay();}
function dateAdd(day,n){return new Date(Date.parse(day+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);}
function nextScheduled(game,now){
 // A time lock is produced for a FUTURE draw, never for a draw that already happened.
 // Conservative 19:00 China cutoff; actual draw time is later, making it safe.
 const local=cndate(now),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));
 for(let i=0;i<8;i++){const day=dateAdd(local,i);if(SCHEDULE[game].includes(weekday(day))&&(i>0||hour<19))return day;}
 return null;
}
function latestExpectedDraw(game,now){
 const local=cndate(now),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(now));
 let day=local;
 if(hour<22 || !SCHEDULE[game].includes(weekday(local)))return previousScheduled(game,local);
 return day;
}
function previousScheduled(game,target){let day=target;for(let i=0;i<9;i++){day=dateAdd(day,-1);if(SCHEDULE[game].includes(weekday(day)))return day;}return null;}
function validated(raw,game){
 const rules=GAMES[game],seen=new Set(),out=[];
 for(const row of raw){
  if(!row||!/^20\d{5}$/.test(String(row.issue))||!/^20\d\d-\d\d-\d\d$/.test(String(row.date)))throw Error(game+': invalid date/issue');
  if(seen.has(row.issue))throw Error(game+': repeated issue '+row.issue);seen.add(row.issue);
  for(const [field,count,max] of [['main',rules.mainCount,rules.mainMax],['extra',rules.extraCount,rules.extraMax]]){
   const a=row[field];if(!Array.isArray(a)||a.length!==count||new Set(a).size!==count||a.some(n=>!Number.isInteger(n)||n<1||n>max))throw Error(game+': invalid '+field+' '+row.issue);
  }
  out.push(row);
 }
 return out.sort((a,b)=>b.issue.localeCompare(a.issue));
}
function summary(records,game){
 const rows=records.filter(x=>x.game===game),settled=rows.filter(x=>x.status==='settled');
 const byMode={};
 for(const mode of MODES){const vals=settled.map(x=>x.outcome?.[mode]).filter(Boolean);
  byMode[mode]={n:vals.length,meanMain:vals.length?+(vals.reduce((s,v)=>s+v.main,0)/vals.length).toFixed(3):null,meanExtra:vals.length?+(vals.reduce((s,v)=>s+v.extra,0)/vals.length).toFixed(3):null};
 }
 return {settled:settled.length,pending:rows.filter(x=>x.status==='pending').length,byMode};
}
export function run(now=new Date(),root='.'){
 const history=JSON.parse(fs.readFileSync(root+'/'+HISTORY,'utf8'));
 const outputPath=root+'/'+OUTPUT;
 let existing={schema:'lottery-public-research-v1',generatedAt:null,records:[],summary:{}};
 if(fs.existsSync(outputPath)){
  const old=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  if(old?.schema==='lottery-public-research-v1'&&Array.isArray(old.records))existing=old;
 }
 const records=existing.records;
 let changed=false;const diagnostics={},healthGames={},alerts=[];
 for(const game of Object.keys(GAMES)){
  const rows=validated(history[game]||[],game),target=nextScheduled(game,now);
  const priorExpected=latestExpectedDraw(game,now),latest=rows[0],crossCount=rows.filter(x=>x.verification==='cross-checked').length;
  const isFresh=Boolean(latest&&latest.date>=priorExpected);
  const health={latestIssue:latest?.issue||null,latestDate:latest?.date||null,expectedBySchedule:priorExpected,
    sourceRows:rows.length,independentlyVerified:crossCount,sourceVerification:latest?.verification||'unknown',
    freshness:isFresh?'最新开奖覆盖常规日程':'数据可能滞后（常规日程）',settlement:'尚无已到期提前记录',
    officialError:history.provenance?.[game]?.officialError||'',mirrorError:history.provenance?.[game]?.mirrorError||''};
  healthGames[game]=health;
  if(!isFresh)alerts.push(`${GAMES[game].name}：最新${latest?.date||'无数据'}，常规日程预期${priorExpected}；自动核对可能滞后`);
  if(health.officialError)alerts.push(`${GAMES[game].name} 官方独立核验失败：${health.officialError}`);
  diagnostics[game]={latest:rows[0]?.issue||null,target,readiness:'unknown'};
  if(rows.length<30){diagnostics[game].readiness='不足30期历史数据';continue;}
  // Resolve ONLY predictions previously placed in the repository on a prior run.
  for(const rec of records.filter(x=>x.game===game&&x.status==='pending')){
   const draw=rows.find(d=>d.issue>rec.baseIssue&&d.date===rec.targetDate);
   if(draw){
    const outcome={};for(const p of rec.picks){outcome[p.mode]={main:hit(p.main,draw.main),extra:hit(p.extra,draw.extra)};}
    rec.status='settled';rec.outcome=outcome;rec.actual={issue:draw.issue,date:draw.date,main:draw.main,extra:draw.extra,verification:draw.verification};
    if(Array.isArray(rec.compoundPicks))rec.compoundOutcome=Object.fromEntries(rec.compoundPicks.map(p=>[p.mode,compoundHit({...p,game},draw)]));
    changed=true;
   }
  }
  const settled=records.filter(r=>r.game===game&&r.status==='settled').length;
  const overdue=records.filter(r=>r.game===game&&r.status==='pending'&&r.targetDate< cndate(now)).length;
  health.settlement=overdue?`${overdue}条到期记录尚未核对`:`已核对${settled}条，暂无逾期待核对记录`;
  if(overdue)alerts.push(`${GAMES[game].name}有${overdue}条到期研究记录尚未核对`);
  const prior=previousScheduled(game,target);
  if(rows[0].date!==prior){
   diagnostics[game].readiness=`已知最新开奖${rows[0].date}，按常规日程上期应为${prior}；可能停开或数据未更新，本轮不自动锁定`;
   continue;
  }
  if(records.some(x=>x.game===game&&x.targetDate===target)){
   diagnostics[game].readiness='目标开奖日已存在锁定记录';continue;
  }
  const picks=MODES.map(mode=>{
   const pred=pickV15(rows,game,mode,{window:120,search:360});
   return {mode,label:scoreLabel[mode],main:pred.main,extra:pred.extra,snapshot:pred.snapshot,explanations:pred.explain,pattern:pred.pattern,summary:pred.summ.text,shapePlan:briefShape(pred.shapePlan),shapeActual:pred.shapeActual,softKills:pred.softKills};
  });
  const compoundPicks=['analyst','veteran','trend'].map(mode=>{
    const p=makeCompoundV15(rows,game,mode,{window:120,search:360});
    return {mode,main:p.main,extra:p.extra,bets:p.bets,cost:p.cost,snapshot:p.snapshot,pattern:p.pattern,explanations:p.explain,summary:p.summ.text,shapePlan:briefShape(p.shapePlan),shapeActual:p.shapeActual,softKills:p.softKills};
  });
  const rec={primaryCompoundMode:'veteran',compoundDecision:'三位研究员均保存研究候选；默认仅展示B经验形态复式一组，不代表比其他号码有更高一等奖概率；不自动购买。',id:hash(`${game}|${target}|${rows[0].issue}|${MW_POLICY}`),game,targetDate:target,baseIssue:rows[0].issue,
   createdAt:now.toISOString(),policy:MW_POLICY,window:Math.min(120,rows.length),
   origin:"GitHub Actions public automation; not the user's private device records",status:'pending',picks,compoundPicks,featureSnapshot:{previousIssue:rows[0].issue,patternHistory:historicPatterns(rows,game,60),method:'V16形态先行：软杀号、龙头凤尾、三区比例、奇偶大小、和值跨度、重号连号斜连号，双区独立研究；不代表预测概率',policy:MW_POLICY}};
  records.push(rec);changed=true;diagnostics[game].readiness='新建公开候选，待工作流提交到 GitHub';
 }
 // Only append true before-the-draw records, no retrospective insertion.
 existing.records=records.slice(-600);existing.summary=Object.fromEntries(Object.keys(GAMES).map(g=>[g,summary(existing.records,g)]));
 existing.diagnostics=diagnostics;
 const health={schema:'lottery-health-v1',generatedAt:now.toISOString(),games:healthGames,alerts,
  note:'绿色任务仅说明代码执行成功。数据时效、独立核验和研究核对需要分别检查；常规开奖日可能遇到假期调整。'};
 fs.writeFileSync(root+'/'+HEALTH,JSON.stringify(health,null,2)+'\n');
 for(const alert of alerts)console.warn('::warning::'+alert);
 // Update timestamp only when a real change happened; no daily meaningless commits.
 if(changed||!fs.existsSync(outputPath)){
  existing.generatedAt=now.toISOString();fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(existing,null,2)+'\n');
 }
 return {changed,diagnostics,summary:existing.summary};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{const r=run(process.env.TEST_NOW?new Date(process.env.TEST_NOW):new Date(),process.env.LOTTERY_ROOT||'.');console.log(JSON.stringify(r,null,2));}
 catch(e){console.error('Auto research failed:',e.message);process.exitCode=1;}
}
