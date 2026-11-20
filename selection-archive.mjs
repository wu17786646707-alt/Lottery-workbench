import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {canLock,makeTrial,modes,roadStats,summary} from './selection-engine.js';
import './v187-core.js';
import {updatePositionStudy} from './position-study.js';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const VERSION=1;
export function update(history,records,prior,now=new Date()){
  const data=prior??{schema:VERSION,locks:[],replay:{}};
  if(data.schema!==VERSION || !Array.isArray(data.locks))throw Error('Unexpected selection archive schema');
  for(const game of ['ssq','dlt']){
    const rows=globalThis.V187Core.validRows(game,history[game]);
    if(rows.length<330)continue;
    const current=rows[0];
    for(const record of records.filter(r=>r.game===game)){
      const previous=data.locks.find(l=>l.game===game&&l.targetDate===record.targetDate);
      if(previous||!canLock(record,now,current))continue;
      const training=rows.slice(0,300),stats=roadStats(training,game);
      data.locks.push({game,targetDate:record.targetDate,baseIssue:current.issue,createdAt:now.toISOString(),
        policy:'research-process-1',stats,byMode:Object.fromEntries(modes.map(mode=>[mode,makeTrial(training,game,mode,stats)]))});
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

