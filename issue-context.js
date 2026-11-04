/** V17.2: explicit, read-only draw-vs-research identity.
 * No invented official target issues; the issue after the base is an estimate.
 * Never classifies a record as a future pick when its target draw may already have occurred.
 */
const DOW={ssq:new Set([0,2,4]),dlt:new Set([1,3,6])};
export const chinaDate=(now=new Date())=>new Date(now.getTime()+8*3600000).toISOString().slice(0,10);
export const chinaHour=(now=new Date())=>{const t=new Date(now.getTime()+8*3600000);return t.getUTCHours()+t.getUTCMinutes()/60};
export function nextRegularDate(game,baseDate){
 if(!DOW[game]||!/^20\d{2}-\d{2}-\d{2}$/.test(baseDate||''))return null;
 const d=new Date(baseDate+'T00:00:00Z');if(Number.isNaN(d.getTime()))return null;
 for(let i=1;i<=8;i++){d.setUTCDate(d.getUTCDate()+1);if(DOW[game].has(d.getUTCDay()))return d.toISOString().slice(0,10)}
 return null;
}
export function tentativeIssue(baseIssue,targetDate){
 if(!/^20\d{5}$/.test(baseIssue||''))return null;
 const prevYear=Number(baseIssue.slice(0,4)),seq=Number(baseIssue.slice(4));
 if(!seq||seq>365)return null;
 const yr=Number(String(targetDate||'').slice(0,4));
 if(yr===prevYear)return String(prevYear)+String(seq+1).padStart(3,'0');
 if(yr===prevYear+1)return String(yr)+'001';
 return null;
}
export function recordStage(rec,now=new Date()){
 if(!rec)return 'unknown';
 if(rec.status==='settled')return 'settled';
 const day=chinaDate(now),hour=chinaHour(now);
 if(rec.targetDate<day||(rec.targetDate===day&&hour>=22.5))return 'overdue';
 if(rec.targetDate===day)return 'today';
 return 'future';
}
export function issueContext(game,rows=[],publicLog=null,now=new Date()){
 const latest=rows?.[0]||null,day=chinaDate(now);if(!latest)return {game,latest:null,baseIssue:null,targetDate:null,targetIssue:null,stage:'missing',canRecommend:false,day,source:'none',record:null};
 const locked=(publicLog?.records||[]).filter(r=>r.game===game&&r.status==='pending'&&r.baseIssue===latest.issue&&r.targetDate>latest.date).sort((a,b)=>a.targetDate.localeCompare(b.targetDate))[0]||null;
 const targetDate=locked?.targetDate||nextRegularDate(game,latest.date);
 const targetIssue=tentativeIssue(latest.issue,targetDate);
 const clockStage=recordStage({targetDate,status:'pending'},now);
 const stage=clockStage==='overdue'?'overdue':clockStage;
 return {game,latest,baseIssue:latest.issue,baseDate:latest.date,targetDate,targetIssue,
  day,stage,canRecommend:stage==='future'||stage==='today',
  source:locked?'github-lock':'schedule-estimate',record:locked,
  issueEstimated:true};
}
export const fmtTarget=c=>c.targetDate?`${c.targetIssue?`预计第${c.targetIssue}期`:'期号待确认'}（${c.targetDate}）`:'期次待确认';
export const fmtBase=c=>c.latest?`第${c.baseIssue}期（${c.baseDate}，已开奖）`:'尚无已收录的历史开奖';
export function statusText(c){
 if(c.stage==='missing')return '暂无可信历史基准，暂停下一期选号';
 if(c.stage==='overdue')return '目标开奖时间已过、但最新结果尚未同步；暂停下一期选号，请先刷新开奖数据';
 if(c.stage==='today')return '预计今天开奖；请在截止时间前核验官方安排';
 if(c.stage==='future')return '预计未来开奖；具体期次及日期请以官方公告为准';
 return '目标期次状态尚未确认';
}
