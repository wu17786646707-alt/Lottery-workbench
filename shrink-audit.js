const labels=['23码大底外','23码 → 15码','15码 → 复式','复式 → 单式','单式保留'];
export function traceDraw(stages,actual){
 return labels.map((label,index)=>{
  const row={label};
  for(const part of ['main','extra']){
   row[part]=actual[part].filter(n=>index===4?stages[3][part].includes(n):
    (index===0||stages[index-1][part].includes(n))&&!stages[index][part].includes(n));
  }
  return row;
 });
}
const format=balls=>balls.map(n=>String(n).padStart(2,'0')).join(' ')||'—';
export function traceHTML(stages,actual){
 const rows=traceDraw(stages,actual);
 return '<details><summary>开奖号码在哪一步被删掉？</summary><p>每个开奖号码只归入一个环节。主区和副区分别列出。</p>'+
 rows.map(r=>'<p><b>'+r.label+'</b>　主区 '+format(r.main)+'　副区 '+format(r.extra)+'</p>').join('')+'</details>';
}
export function rearRationale(plan){
 const pool=plan.stages[2].extra,single=plan.stages[3].extra;
 return '<details><summary>副区从复式到单式，为什么留这个号？</summary><p>按本期综合排名取前位。排名使用原始分；综合分在此显示四位小数，同分按号码升序。</p>'+
 plan.rearEvidence.filter(r=>pool.includes(r[0])).map(r=>'<p><b>'+format([r[0]])+'</b>　'+(single.includes(r[0])?'单式保留':'缩出单式')+'　频次第 '+r[3]+'　走势第 '+r[4]+'　综合分 '+Number(r[5]).toFixed(4)+'</p>').join('')+'</details>';
}

// Conditional reference: sample the same number uniformly from the same parent pool.
export function retention(parent,child,actual){
 const inDraw=n=>actual.includes(n);
 const available=parent.filter(inDraw).length;
 return {available,kept:child.filter(inDraw).length,expected:available*child.length/parent.length};
}

export function removalDiagnosis(plan,actual){
 const stages=plan.stages;
 const sections=[];
 for(let i=1;i<stages.length;i++){
  const from=stages[i-1],to=stages[i];
  for(const part of ['main','extra']){
   const main=part==='main',rank=main?plan.evidence:plan.rearEvidence;
   const {available,kept,expected}=retention(from[part],to[part],actual[part]);
   const lost=from[part].filter(n=>actual[part].includes(n)&&!to[part].includes(n));
   const ordered=rank.map(r=>r[0]).filter(n=>from[part].includes(n));
   const fixed=main&&i>=2?plan.gold:[];
   const scoreOnly=[...fixed,...ordered.filter(n=>!fixed.includes(n))].slice(0,to[part].length);
   const reasons=lost.map(n=>{
    const place=ordered.indexOf(n)+1;
    const why=main?(scoreOnly.includes(n)?'同胆按分可入围，结构筛选后落选':'同样名额按分筛选也会落选'):'综合排序超出保留名额';
    return format([n])+'（上层池第'+place+'，'+why+'）';
   });
   sections.push('<p><b>'+[null,'大底 → 15码池','15码池 → 复式','复式 → 单式'][i]+' · '+(main?'主区':'副区')+'</b><br>上层中 '+available+'，实际留 '+kept+'，等额随机平均留 '+expected.toFixed(2)+'。'+(reasons.length?' 删除 '+reasons.join('、')+'。':'')+'</p>');
  }
 }
 return '<details><summary>逐层诊断：哪些落选与结构筛选有关？</summary><p>随机参考按上层已中个数 × 下层名额 ÷ 上层名额计算。它用于复盘；单期偏差也会由随机波动产生。</p>'+sections.join('')+'</details>';
}
