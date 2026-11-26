import {JOINT} from './joint-rule.js';
import {replayStages} from './replay-stages.js';
import {processPolicy} from './selection-engine.js';
import {drawDeadline} from './issue-context.js';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {canLock,makeTrial,modes,roadStats,summary} from './selection-engine.js';
import './v187-core.js';
import {updatePositionStudy} from './position-study.js';
import {forecast, usablePair} from './trajectory.js';
function archiveTrajectory(data,game,rows,records,now){
  const entry=records.find(r=>r.game===game && canLock(r,now,rows[0]));
  if(!entry || rows.length<2 || !usablePair([rows[1],rows[0]],2))return;
  const locks=data.trajectoryLocks??=[];
  if(locks.some(x=>x.game===game && x.targetDate===entry.targetDate && x.policy==='trajectory-v1'))return;
  const bases=[rows[1],rows[0]].map(({issue,date,main,extra})=>({issue,date,main,extra}));
  const projection=forecast(game,...bases);
  const saved=Object.fromEntries(['main','extra'].map(f=>[f,{
    pool:[...projection[f].marks.keys()],numbers:projection[f].numbers,fillers:projection[f].fillers
  }]));
  locks.push({policy:'trajectory-v1',game,targetDate:entry.targetDate,createdAt:now.toISOString(),bases,saved});
}
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const VERSION=1;
export function update(history,records,prior,now=new Date()){
  const data=prior??{schema:VERSION,locks:[],replay:{}};
  if(data.schema!==VERSION || !Array.isArray(data.locks))throw Error('Unexpected selection archive schema');
  for(const game of ['ssq','dlt']){
    const rows=globalThis.V187Core.validRows(game,history[game]);
    archiveTrajectory(data,game,rows,records,now);
    if(rows.length<330)continue;
    const current=rows[0];
    data.stageReplay??={};
    const fingerprint=JSON.stringify(rows.slice(0,330).map(r=>[r.issue,r.date,r.main,r.extra]));
    const previousReplay=data.stageReplay[game];
    if(previousReplay?.jointRule!==JOINT||previousReplay?.policy!==processPolicy||previousReplay?.fingerprint!==fingerprint)
      data.stageReplay[game]={...replayStages(rows,game),fingerprint};
    for(const record of records.filter(r=>r.game===game)){
      const previous=data.locks.find(l=>l.game===game&&l.targetDate===record.targetDate);
      if(record.revisionKey && record.status==='pending' && record.baseIssue===current.issue
        && now.getTime()<drawDeadline(game,record.targetDate) && Date.parse(record.createdAt)<=now.getTime()){
        if(previous?.revisionKey===record.revisionKey)continue;
      }else if(previous||!canLock(record,now,current))continue;
      const training=rows.slice(0,300),stats=roadStats(training,game);
      const next={game,targetDate:record.targetDate,baseIssue:current.issue,revisionKey:record.revisionKey,createdAt:record.revisionKey?record.createdAt:now.toISOString(),
        policy:record.stagesByMode ? record.policy : 'research-process-1',stats,byMode:Object.fromEntries(modes.map(mode=>{
          const trial=makeTrial(training,game,mode,stats);
          if(record.stagesByMode)trial.stages=record.stagesByMode[mode];
          return [mode,trial];
        }))};
      if(previous)data.locks[data.locks.indexOf(previous)]=next;else data.locks.push(next);
    }
    if(game==='ssq')updatePositionStudy(data,rows,records,now);
    if(data.replay[game]?.baseIssue===current.issue)continue;
    const samples=Object.fromEntries(modes.map(m=>[m,[]]));
    for(let i=0;i<30;i++){
      const training=rows.slice(i+1,i+301),stats=roadStats(training,game);
      for(const mode of modes)samples[mode].push({trial:makeTrial(training,game,mode,stats),draw:rows[i]});
    }
    data.replay[game]={baseIssue:current.issue,firstIssue:rows[29].issue,
      byMode:Object.fromEntries(modes.map(m=>[m,summary(samples[m])]))};
  }
  return data;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const path='selection-data.json';
  const data=update(read('history.json'),read('research.json').records,fs.existsSync(path)?read(path):null);
  const encoded=JSON.stringify(data)+'\n';
  if(!fs.existsSync(path)||fs.readFileSync(path,'utf8')!==encoded){
    fs.writeFileSync(path+'.tmp',encoded);fs.renameSync(path+'.tmp',path);
  }
}

