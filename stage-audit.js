// The same scorer handles the screenshot pools and the public workbench locks.
export function stageAudit(stages, draw, game) {
  const limits = game === 'ssq' ? [33, 16] : [35, 12];
  const sizes = game === 'ssq' ? [6, 1] : [5, 2];
  return stages.map((stage, i) => ['main', 'extra'].map((key, side) => {
    const picks = stage[key];
    const hits = draw?.[key]?.filter(n => picks.includes(n)) ?? [];
    const lost = draw?.[key]?.filter(n => !picks.includes(n) &&
      (!i || stages[i - 1][key].includes(n))) ?? [];
    return {hits, lost, mean: picks.length * sizes[side] / limits[side]};
  }));
}

// Compare a single substitution against the locked 7+2 on identical draws.
export function heatTrial(history, baseIssue, pool) {
  const start = history.findIndex(row => String(row.issue) === String(baseIssue));
  if (start < 0 || start + 30 > history.length || pool.main.length !== 7) return null;
  const rows = history.slice(start, start + 30);
  const stats = Array.from({length:35}, (_, i) => {
    const n = i + 1;
    return {n, short:rows.slice(0,10).filter(r=>r.main.includes(n)).length,
      long:rows.filter(r=>r.main.includes(n)).length};
  });
  const ordered = stats.sort((a,b)=>b.short-a.short || b.long-a.long || a.n-b.n);
  const incoming = ordered.find(v=>v.short>=4 && v.long>=8 && !pool.main.includes(v.n));
  const outgoing = ordered.slice().reverse().find(v=>pool.main.includes(v.n));
  const main = incoming ? pool.main.map(n=>n===outgoing.n?incoming.n:n).sort((a,b)=>a-b) : pool.main.slice();
  return {main, extra:pool.extra.slice(), incoming:incoming?.n, outgoing:incoming?outgoing.n:undefined};
}

export const author134 = {
  draw:{main:[4,15,17,24,31],extra:[6,9]},
  stages:[
    {main:[3,5,6,8,10,11,12,13,14,15,17,18,20,22,25,26,27,28,29,31,32,33,34],extra:[2,4,6,7,8,9,11]},
    {main:[3,5,6,8,13,15,17,18,20,22,25,28,31,34],extra:[2,4,6,7,9,11]},
    {main:[3,5,6,8,13,17,18,20,22,28,31,34],extra:[4,6,9,11]}
  ]
};
