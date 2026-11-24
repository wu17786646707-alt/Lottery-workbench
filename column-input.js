function byStrength(rows,key,max){
 const recent=rows[0][key];
 return Array.from({length:max},(_,i)=>{
  const n=i+1, seen=rows.map(r=>r[key].includes(n));
  const ten=seen.slice(0,10).filter(Boolean).length, thirty=seen.filter(Boolean).length;
  const gap=seen.indexOf(true);
  return {n,ten,thirty,gap:gap<0?30:gap,score:thirty+ten,relation:recent.includes(n)?'重号':recent.some(v=>Math.abs(v-n)===1)?'邻号':'—'};
 }).sort((a,b)=>b.score-a.score||a.n-b.n);
}
function mostCommon(keys){
 const counts=new Map();
 for(const key of keys)counts.set(key,(counts.get(key)||0)+1);
 return [...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||String(a).localeCompare(String(b)))[0];
}
export function columnPool(rows,g){
 if(rows.length!==30)throw Error('需要连续 30 条开奖记录');
 const isRed=g==='ssq', count=isRed?6:5, limits=isRed?[33,16]:[35,12], cuts=isRed?[11,22]:[12,24];
 const zone=n=>n<=cuts[0]?0:n<=cuts[1]?1:2;
 const front=byStrength(rows,'main',limits[0]), back=byStrength(rows,'extra',limits[1]);
 const sorted=rows.map(r=>[...r.main].sort((a,b)=>a-b));
 const shape=a=>[0,1,2].map(z=>a.filter(n=>zone(n)===z).length).join(',');
 const zoneKey=mostCommon(sorted.map(shape)), quota=zoneKey.split(',').map(Number);
 const ranks=front.map(r=>r.n), aux=back.map(r=>r.n);
 const at=[0,2,count-1], freq=at.map(index=>Object.fromEntries(ranks.map(n=>[n,sorted.filter(a=>a[index]===n).length])));
 const positional=freq.map(f=>ranks.slice().sort((a,b)=>f[b]-f[a]).slice(0,3));
 const reserve=front.filter(v=>v.ten===0).sort((a,b)=>b.gap-a.gap||a.n-b.n).slice(0,1).map(v=>v.n);
 const union=(...lists)=>[...new Set(lists.flat())];
 const zonal=quota.flatMap((k,z)=>ranks.filter(n=>zone(n)===z).slice(0,k));
 const broad=union(zonal,positional.flat(),reserve,ranks).slice(0,23);

 return {front,back,broad,side:aux.slice(0,isRed?8:7),quota,cuts,positional,reserve};
}

const ascending = list => list.slice().sort((a,b)=>a-b);
const unique = list => [...new Set(list)];
const cutsFor = (n,ends) => ends.findIndex(end=>n<=end);

function bandPlan(rows,ends) {
 const shapes=rows.map(r=>ends.map((_,i)=>r.extra.filter(n=>cutsFor(n,ends)===i).length).join(','));
 return mostCommon(shapes).split(',').map(Number);
}

export function columnChoices(rows,game,mode) {
 const past=rows.slice(0,30),base=columnPool(past,game),ssq=game==='ssq';
 const ends=[...base.cuts,ssq?33:35],zone=n=>cutsFor(n,ends);
 const shortChange=(a,b)=>(3*b.ten-b.thirty)-(3*a.ten-a.thirty);
 function compare(a,b){
  if(mode==='analyst')return b.thirty-a.thirty || b.ten-a.ten || a.n-b.n;
  if(mode==='trend')return shortChange(a,b) || b.ten-a.ten || a.n-b.n;
  return b.ten-a.ten || b.thirty-a.thirty || a.n-b.n;
 }
 const ranking=base.front.filter(r=>base.broad.includes(r.n)).sort(compare);
 const sizes=ssq?[15,8]:[13,7];
 // Each shrink starts from its predecessor. Reserve enough places in each band
 // for the target shape; the remaining places compete across bands.
 function shrink(input,size){
  const required=base.quota.flatMap((k,z)=>input.filter(r=>zone(r.n)===z).slice(0,k));
  const pool=new Set();
  for(const r of [...required,...input]){
   pool.add(r);
   if(pool.size===size)break;
  }
  return input.filter(r=>pool.has(r));
 }
 const initial=shrink(ranking,sizes[0]);
 const budget=shrink(initial,sizes[1]);
 const chosen=[];
 const reasons=[];
 base.quota.forEach((count,z)=>{
  const zoneRanks=budget.filter(r=>zone(r.n)===z),group=[];
  const previous=past[0].main.filter(n=>zone(n)===z).length;
  for(let i=0;i<count;i++){
   const left=zoneRanks.filter(r=>!group.includes(r.n));
   let pick=left[0],reason='区内排名';
   if(mode==='veteran'&&i>0){
    const cold=i===count-1&&count>previous&&left.find(r=>r.ten===0&&r.thirty>0&&past.slice(0,3).filter(d=>d.main.some(n=>Math.abs(n-r.n)===1)).length>=2);
    const neighbor=left.find(r=>r.ten>0&&Math.abs(r.n-group[0])===1);
    pick=cold||neighbor||pick;reason=cold?'增额防冷':neighbor?'活跃邻号补位':reason;
   }
   group.push(pick.n);reasons.push(pick.n+'（'+reason+'，近10/30期 '+pick.ten+'/'+pick.thirty+'）');
  }
  chosen.push(...group);
 });
 const extraEnds=ssq?[5,10,16]:[6,12],sideRanks=base.back.filter(r=>base.side.includes(r.n)).sort(compare);
 const shape=bandPlan(past,extraEnds);
 const preferred=shape.flatMap((k,i)=>sideRanks.filter(r=>cutsFor(r.n,extraEnds)===i).slice(0,k));
 const sideOrder=unique([...(mode==='veteran'?preferred:[]),...sideRanks].map(r=>r.n));
 const side=sideOrder.slice(0,ssq?1:2);
 const sideFacts=sideOrder.slice(0,5).map(n=>{
  const r=sideRanks.find(x=>x.n===n);
  return n+'（10期 '+r.ten+' 次，30期 '+r.thirty+' 次'+(r.gap===0?'，上期刚开':'')+'）';
 });
 const runners=budget.filter(r=>!chosen.includes(r.n)).map(r=>r.n);
 const stages=[{main:ascending(initial.map(r=>r.n)),extra:ascending(sideOrder.slice(0,5))},
  {main:ascending(budget.map(r=>r.n)),extra:ascending(side)},
  {main:ascending(chosen),extra:ascending(side)}];
 const rule={analyst:'近30期次数，同频看近10期',veteran:'近10期次数，同区按条件补邻号或冷备；副区先比较分段名额',trend:'比较近10期与此前20期的出现速率变化'}[mode];
 return {stages,source:{main:ascending(base.broad),extra:ascending(base.side)},summary:'专栏大底按龙头、中位、凤尾、分区及冷备汇总。三区名额 '+base.quota.join('∶')+'。本研究员按'+rule+'筛选。'+reasons.join('、')+'。复式缩到单式时舍弃 '+runners.join('、')+'。副区前五顺位 '+sideFacts.join('、')+'，最终 '+side.join('、')+'。'};
}
