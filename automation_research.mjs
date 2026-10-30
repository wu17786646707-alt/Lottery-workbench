#!/usr/bin/env node
/**
 * Public, deterministic A/B/C research log. This does not upload private iPhone records.
 * Runs in GitHub Actions BEFORE the target drawing, and commits predictions to Git history.
 * No prediction is invented for past draws. Historical backtests remain separate.
 */
import fs from 'node:fs';
import {pick, hit, scoreLabel} from './engine.js';
import {GAMES, POLICY, hash} from './core.js';

const HISTORY='history.json', OUTPUT='research.json';
const SCHEDULE={ssq:[0,2,4],dlt:[1,3,6]}; // UTC weekday for Beijing calendar date (Sun=0); holidays excluded
const MODES=['analyst','veteran','trend','random'];
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
 let changed=false;const diagnostics={};
 for(const game of Object.keys(GAMES)){
  const rows=validated(history[game]||[],game),target=nextScheduled(game,now);
  diagnostics[game]={latest:rows[0]?.issue||null,target,readiness:'unknown'};
  if(rows.length<30){diagnostics[game].readiness='不足30期历史数据';continue;}
  // Resolve ONLY predictions previously placed in the repository on a prior run.
  for(const rec of records.filter(x=>x.game===game&&x.status==='pending')){
   const draw=rows.find(d=>d.issue>rec.baseIssue&&d.date>=rec.targetDate);
   if(draw){
    const outcome={};for(const p of rec.picks){outcome[p.mode]={main:hit(p.main,draw.main),extra:hit(p.extra,draw.extra)};}
    rec.status='settled';rec.outcome=outcome;rec.actual={issue:draw.issue,date:draw.date,main:draw.main,extra:draw.extra,verification:draw.verification};changed=true;
   }
  }
  const prior=previousScheduled(game,target);
  if(rows[0].date!==prior){
   diagnostics[game].readiness=`已知最新开奖${rows[0].date}，按常规日程上期应为${prior}；可能停开或数据未更新，本轮不自动锁定`;
   continue;
  }
  if(records.some(x=>x.game===game&&x.targetDate===target)){
   diagnostics[game].readiness='目标开奖日已存在锁定记录';continue;
  }
  const picks=MODES.map(mode=>{
   const pred=pick(rows,game,mode,{window:60,search:450});
   return {mode,label:scoreLabel[mode],main:pred.main,extra:pred.extra,snapshot:pred.snapshot};
  });
  const rec={id:hash(`${game}|${target}|${rows[0].issue}|${POLICY}`),game,targetDate:target,baseIssue:rows[0].issue,
   createdAt:now.toISOString(),policy:POLICY,window:Math.min(60,rows.length),
   origin:"GitHub Actions public automation; not the user's private device records",status:'pending',picks};
  records.push(rec);changed=true;diagnostics[game].readiness='新建公开候选，待工作流提交到 GitHub';
 }
 // Only append true before-the-draw records, no retrospective insertion.
 existing.records=records.slice(-600);existing.summary=Object.fromEntries(Object.keys(GAMES).map(g=>[g,summary(existing.records,g)]));
 existing.diagnostics=diagnostics;
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
