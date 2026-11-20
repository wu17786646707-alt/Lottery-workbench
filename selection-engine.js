import {GAMES, hash} from './core.js?v=18.0';
import {factTable, makeCompoundV15, scoreFeature} from './multiwindow.js?v=18.0';

export const modes = ['analyst', 'veteran', 'trend'];
const parts = ['main', 'extra'];
const sorted = values => [...values].sort((a,b) => a-b);
const ticket = pick => ({main: pick.main, extra: pick.extra});
export const roadCounts = numbers => numbers.reduce((a,n) => { a[n % 3]++; return a; }, [0,0,0]);

export function roadStats(rows, game) {
  const sample = rows.slice(0, 30);
  const result = {sample:sample.length, baseIssue:sample[0]?.issue};
  for (const part of parts) {
    const max = GAMES[game][part+'Max'];
    const groups = Array.from({length:3}, (_,r) => Array.from({length:max}, (_,i)=>i+1).filter(n=>n%3===r));
    const counts = roadCounts(sample.flatMap(r => r[part]));
    const total = counts.reduce((a,b)=>a+b,0);
    result[part] = {counts, groups, total, adjustment:counts.map((n,r)=>0.2*(groups[r].length/max - n/total))};
  }
  return result;
}

function control(game, baseIssue) {
  const g = GAMES[game];
  let state = parseInt(hash(game+'|'+baseIssue+'|selection-control-1'),16) >>> 0;
  const draw = (max,size) => {
    const values=Array.from({length:max},(_,i)=>i+1);
    for(let i=0;i<size;i++){
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      const j=i+Math.floor(state/4294967296*(max-i));
      [values[i],values[j]]=[values[j],values[i]];
    }
    return sorted(values.slice(0,size));
  };
  return {main:draw(g.mainMax,game==='ssq'?8:7),extra:draw(g.extraMax,g.extraCount)};
}

function poolFromScores(rows, game, mode) {
  const pool={}, bans={};
  for(const part of parts){
    const size=part==='extra'?5:game==='ssq'?15:13;
    const ranked=factTable(rows,game,part).rows.map(f=>({n:f.n,score:scoreFeature(f,mode,game,part,120)}))
      .sort((a,b)=>b.score-a.score||a.n-b.n);
    pool[part]=sorted(ranked.slice(0,size).map(x=>x.n));
    bans[part]=ranked.slice(size).map(x=>x.n);
  }
  return {pool,bans};
}

export function makeTrial(rows,game,mode,stats=roadStats(rows,game)) {
  const base=makeCompoundV15(rows,game,mode);
  const off=makeCompoundV15(rows,game,mode,{useSoftKills:false});
  const road=makeCompoundV15(rows,game,mode,{roadAdjustments:{main:stats.main.adjustment,extra:stats.extra.adjustment}});
  const {pool,bans}=poolFromScores(rows,game,mode);
  const restricted=makeCompoundV15(rows,game,mode,{bans});
  return {stages:[pool,ticket(restricted),{main:restricted.single,extra:restricted.extra}],
    kills:base.softKills, arms:{base:ticket(base),off:ticket(off),road:ticket(road),random:control(game,rows[0].issue)}};
}

export function canLock(record, now, latest) {
  const cutoff=Date.parse(record.targetDate+'T19:00:00+08:00');
  return record.status==='pending' && latest?.issue===record.baseIssue && latest.date<record.targetDate &&
    Date.parse(record.createdAt)<=now.getTime() && now.getTime()<cutoff;
}
export function hits(guess, draw) {
  return parts.map(part=>guess[part].filter(n=>draw[part].includes(n)).length);
}

export function summary(trials) {
  const result={n:trials.length,rows:{},wrong:[0,0],lost:[0,0],gained:[0,0]};
  for(const {trial,draw} of trials) {
    const on=hits(trial.arms.base,draw), off=hits(trial.arms.off,draw);
    for (const part of [0,1]) {
      result.wrong[part]+=hits(trial.kills,draw)[part];
      result.lost[part]+=Math.max(0,off[part]-on[part]);
      result.gained[part]+=Math.max(0,on[part]-off[part]);
    }
    for(const [key,pick] of Object.entries(trial.arms)) {
      const val=result.rows[key]??=[0,0];
      hits(pick,draw).forEach((x,i)=>val[i]+=x);
    }
  }
  return result;
}

