const num=n=>String(n).padStart(2,'0');
export function outerAudit(plan,actual){
 if(!actual)return '';
 const lines=[];
 for(const [part,rows] of [['main',plan.evidence],['extra',plan.rearEvidence]]){
  const pool=plan.stages[0][part],cut=rows[pool.length-1];
  const title=part==='main'?'主区':'副区';
  const misses=actual[part].filter(n=>!pool.includes(n));
  lines.push('<p><b>'+title+'取前 '+pool.length+' 名</b>，末位 '+num(cut[0])+'，综合分 '+cut[5].toFixed(4)+'。</p>');
  if(!misses.length){lines.push('<p>'+title+'全部入围。</p>');continue;}
  for(const n of misses){
   const i=rows.findIndex(row=>row[0]===n),r=rows[i];
   if(!r)continue;
   const tied=r[3]===cut[3]&&r[4]===cut[4];
   lines.push('<p>'+num(n)+' · 综合第 '+(i+1)+'，频次第 '+r[3]+'、走势第 '+r[4]+'；近30期出现 '+r[1]+' 次，最近10期较前10期变化 '+r[2]+' 次。'+(tied?'与末位两项排名相同，按号码升序排在名额外。':'')+'</p>');
  }
 }
 return '<details><summary>第一步：大底为什么漏号？</summary>'+lines.join('')+'</details>';
}
