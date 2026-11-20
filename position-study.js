import {canLock,makeTrial} from './selection-engine.js';

export const studyPolicy = 'ssq-position-v1';
const intersection=(left,right)=>left.filter(n=>right.includes(n));
const sorted=values=>[...values].sort((a,b)=>a-b);

export function positionTrial(rows,veteran) {
  if(rows.length<30)throw Error('补位试验至少需要 30 期');
  const sample=rows.slice(0,30);
  const counts=Array.from({length:34},()=>({all:0,head:0,tail:0}));
  for(const row of sample){
    const values=sorted(row.main);
    for(const n of values)counts[n].all++;
    counts[values[0]].head++;
    counts[values.at(-1)].tail++;
  }
  const blueCounts=Array(17).fill(0);
  for(const draw of sample)blueCounts[draw.extra[0]]++;
  const blueRank=Array.from({length:16},(_,i)=>i+1).sort((a,b)=>blueCounts[b]-blueCounts[a]||a-b);
  const blueStages=[8,4,1].map(n=>sorted(blueRank.slice(0,n)));
  const numbers=Array.from({length:33},(_,i)=>i+1);
  const byHead=[...numbers].sort((a,b)=>counts[b].head-counts[a].head||a-b);
  const byTail=[...numbers].sort((a,b)=>counts[b].tail-counts[a].tail||b-a);
  const head=byHead[0],tail=byTail[0];
  const [pool,base]=veteran.stages;
  const gold=pool.main.slice().sort((a,b)=>counts[b].all-counts[a].all||a-b).slice(0,4);
  const aims=[{role:'龙头',number:head,count:counts[head].head},{role:'凤尾',number:tail,count:counts[tail].tail}];
  const removable=base.main.filter(n=>!gold.includes(n)&&n!==head&&n!==tail)
    .sort((a,b)=>counts[a].all-counts[b].all||b-a);
  const revised=[...base.main];
  for(const aim of aims){
    if(pool.main.includes(aim.number)||revised.includes(aim.number))continue;
    const out=removable.shift();
    if(out===undefined)throw Error('缺少可替换的红球');
    revised.splice(revised.indexOf(out),1,aim.number);
    aim.dropped=out;
  }
  return {baseIssue:rows[0].issue,windowEnd:sample.at(-1).issue,pool:[...pool.main],base:[...base.main],
    revised:sorted(revised),blue:base.extra[0],blueStages,gold:sorted(gold),aims,random:{main:veteran.arms.random.main,blue:veteran.arms.random.extra[0]}};
}

export function positionScore(trial,draw){
  const actual=sorted(draw.main),[head,tail]=trial.aims;
  const before=intersection(trial.base,actual).length,after=intersection(trial.revised,actual).length;
  return {blueSteps:trial.blueStages.map(pool=>pool.includes(draw.extra[0])),before,after,delta:after-before,changed:trial.aims.some(a=>a.dropped!==undefined),
    gold:intersection(trial.gold,actual).length,poolHits:intersection(trial.pool,actual).length,
    headExact:head.number===actual[0],tailExact:tail.number===actual.at(-1),
    fixedHead:actual[0]===1,fixedTail:actual.at(-1)===33,
    randomHits:intersection(trial.random.main,actual).length,randomBlue:draw.extra.includes(trial.random.blue),blue:draw.extra.includes(trial.blue)};
}

export function aggregate(scores){
  const a={n:scores.length,changed:0,better:0,worse:0,tie:0,before:0,after:0,blue:0,randomHits:0,randomBlue:0,
    headExact:0,tailExact:0,fixedHead:0,fixedTail:0,goldHits:0,poolHits:0,blueSteps:[0,0,0],hist:[0,0,0,0,0]};
  for(const s of scores){
    for(const k of ['changed','before','after','blue','randomHits','randomBlue','headExact','tailExact','fixedHead','fixedTail','poolHits'])a[k]+=Number(s[k]);
    a[s.delta>0?'better':s.delta<0?'worse':'tie']++;
    s.blueSteps.forEach((hit,i)=>a.blueSteps[i]+=Number(hit));
    a.goldHits+=s.gold;a.hist[s.gold]++;
  }
  return a;
}

// V18.8 archives stay immutable. Supplemental locks have their own timestamp.
export function updatePositionStudy(data,rows,records,now){
  const study=data.positionStudy??={policy:studyPolicy,locks:[]};
  if(study.policy!==studyPolicy)throw Error('未知的补位规则版本');
  if(rows.length<330)return;
  for(const r of records.filter(r=>r.game==='ssq')){
    if(!canLock(r,now,rows[0])||study.locks.some(l=>l.targetDate===r.targetDate))continue;
    const prior=data.locks.find(l=>l.game==='ssq'&&l.targetDate===r.targetDate&&l.baseIssue===r.baseIssue);
    if(!prior?.byMode?.veteran||Date.parse(prior.createdAt)>now.getTime())continue;
    study.locks.push({targetDate:r.targetDate,createdAt:now.toISOString(),trial:positionTrial(rows,prior.byMode.veteran)});
  }
  if(study.replay?.last===rows[0].issue)return;
  const scores=[];
  for(let i=0;i<30;i++){
    const past=rows.slice(i+1,i+301),veteran=makeTrial(past,'ssq','veteran');
    scores.push(positionScore(positionTrial(past,veteran),rows[i]));
  }
  study.replay={first:rows[29].issue,last:rows[0].issue,...aggregate(scores)};
}
