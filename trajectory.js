import {GAMES} from './core.js?v=18.0';

export const methods = {line:'斜线', turn:'折返', triangle:'三角', star:'五角星'};

export function trace(older, latest, max) {
  const a = new Set(older), b = new Set(latest), marks = new Map();
  for (let x=1; x<=max; x++) {
    const paths = [];
    for (const d of [1,2]) {
      for (const s of [d,-d]) {
        if (a.has(x-2*s) && b.has(x-s)) paths.push({rule:'line', points:[x-2*s,x-s,x]});
        if (a.has(x) && b.has(x+s)) paths.push({rule:'turn', points:[x,x+s,x]});
      }
      if (b.has(x-d) && b.has(x+d)) paths.push({rule:'triangle', points:[x-d,x+d,x]});
      if (a.has(x-d) && a.has(x+d) && b.has(x-2*d) && b.has(x+2*d)) {
        paths.push({rule:'star', points:[x-d,x+d,x-2*d,x+2*d,x]});
      }
    }
    if (paths.length) marks.set(x,{paths, rules:[...new Set(paths.map(p=>p.rule))]});
  }
  return marks;
}

// Take the lower midpoint of the longest available run. Equal lengths keep the leftmost run.
function gapMidpoint(selected,max) {
  let bestStart=0, bestLength=0, length=0;
  for (let x=1; x<=max; x++) {
    length = selected.has(x) ? 0 : length+1;
    if (length>bestLength) {bestLength=length; bestStart=x-length+1;}
  }
  return bestStart + Math.floor((bestLength-1)/2);
}

function ticket(marks, count, max, preferences) {
  const order=[...marks.keys()].sort((a,b)=>marks.get(b).rules.length-marks.get(a).rules.length || a-b);
  const selected=new Set(), fillers=[];
  for (const rule of preferences) {
    const n=order.find(x=>!selected.has(x) && marks.get(x).rules.includes(rule));
    if (n!==undefined && selected.size<count) selected.add(n);
  }
  for (const n of order) {
    if (selected.size===count) break;
    selected.add(n);
  }
  while (selected.size<count) {
    const n=gapMidpoint(selected,max);
    selected.add(n); fillers.push(n);
  }
  return {numbers:[...selected].sort((a,b)=>a-b), fillers};
}

export function forecast(game,older,latest) {
  const cfg=GAMES[game], result={};
  for (const field of ['main','extra']) {
    const max=cfg[field+'Max'], count=cfg[field+'Count'];
    const marks=trace(older[field],latest[field],max);
    const preferences=field==='main'?[]:game==='ssq'?['turn']:['turn','line'];
    result[field]={marks,...ticket(marks,count,max,preferences)};
  }
  return result;
}

function adjacent(a,b) {
  return a.date<b.date && (a.issue.slice(0,4)===b.issue.slice(0,4)
    ? Number(b.issue)===Number(a.issue)+1
    : Number(b.issue.slice(0,4))===Number(a.issue.slice(0,4))+1 && b.issue.endsWith('001') &&
      a.date.slice(5,7)==='12' && b.date.slice(5,7)==='01');
}
export const usablePair=(rows,i)=>i>=2 && adjacent(rows[i-2],rows[i-1]);
export const usableTarget=(rows,i)=>usablePair(rows,i) && adjacent(rows[i-1],rows[i]);

function bucket() {
  return {marks:0, hits:0, any:0, full:0, draws:0};
}
function total(bucket,nums,draw) {
  let hits=0;
  for (const n of nums) if (draw.includes(n)) hits++;
  bucket.draws++; bucket.marks+=nums.length; bucket.hits+=hits;
  bucket.any+=Number(hits>0); bucket.full+=Number(hits===draw.length);
  return hits;
}
export function backtest(game,rows,window=600,end=rows.length) {
  const fields=['main','extra'];
  const stats=Object.fromEntries(fields.map(field=>[field,Object.fromEntries(
    ['all','multi',...Object.keys(methods),'ticket','fillers'].map(rule=>[rule,bucket()]))]));
  const result={stats, draws:0, skipped:0, poolJackpots:0, ticketJackpots:0, first:null, last:null};
  for(let i=Math.max(2,end-window);i<end;i++) {
    if(!usableTarget(rows,i)) {result.skipped++; continue;}
    const next=forecast(game,rows[i-2],rows[i-1]), actual=rows[i];
    result.first??=actual; result.last=actual; result.draws++;
    let allCovered=true, ticketMatched=true;
    for (const f of fields) {
      const {marks,numbers,fillers}=next[f], s=stats[f], draw=actual[f];
      const all=[...marks.keys()];
      const h=total(s.all,all,draw), t=total(s.ticket,numbers,draw);
      allCovered=allCovered && h===draw.length; ticketMatched=ticketMatched && t===draw.length;
      total(s.fillers,fillers,draw);
      total(s.multi,all.filter(n=>marks.get(n).rules.length>=2),draw);
      for(const rule of Object.keys(methods)) total(s[rule],all.filter(n=>marks.get(n).rules.includes(rule)),draw);
    }
    result.poolJackpots+=Number(allCovered); result.ticketJackpots+=Number(ticketMatched);
  }
  return result;
}
