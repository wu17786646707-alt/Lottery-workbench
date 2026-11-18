#!/usr/bin/env node
/* Only create reproducible V18.7 compound research locks BEFORE a future draw. */
import fs from 'node:fs';import './v187-core.js';const A=globalThis.V187Core;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const history=read('history.json'),study=read('research.json');const now=new Date(),bjt=new Date(now.getTime()+8*3600*1000),today=bjt.toISOString().slice(0,10),hour=Number(bjt.toISOString().slice(11,13));let changes=0,ignored=0;
for(const rec of (study.records||[])){
 if(!['ssq','dlt'].includes(rec.game)||rec.status!=='pending'||!rec.targetDate||!rec.baseIssue||rec.v187Compound)continue;
 // Must never forge a previously publicly locked prediction. For draw-day, stop at 19:00 BJT.
 if(rec.targetDate<today||(rec.targetDate===today&&hour>=19)){ignored++;continue}
 const base=A.validRows(rec.game,history[rec.game]).filter(x=>x.issue<=rec.baseIssue);
 if(!base.length||base[0].issue!==rec.baseIssue){ignored++;continue}
 if(base.length<120){ignored++;continue}
 const p=A.build(base,rec.game,'multi');const exact=A.exact(rec.game,p.main.length,p.extra.length);
 rec.v187Compound={createdAt:now.toISOString(),targetIssue:String(Number(rec.baseIssue)+1),targetDate:rec.targetDate,baseIssue:rec.baseIssue,mode:'multi',policy:'V18.7-lock-multiwindow-soft-kill-penalty',main:p.main,extra:p.extra,softKills:p.kills,bets:exact.bets,cost:exact.cost,source:'GitHub Actions before-draw public record',explain:p.explain};changes++;
}
if(changes){study.generatedAt=now.toISOString();fs.writeFileSync('research.json',JSON.stringify(study,null,2)+'\n','utf8')}console.log('V18.7 prospective compound locks created:',changes,'skipped stale or unsuitable:',ignored);
