// Parameters are fixed for this release before comparison with prior draws.
export const RULE='research-v18.23-integrated';
const params={analyst:[.55,.45,.65],veteran:[.5,.5,.95],trend:[.35,.65,.65]};
const asc=(a,b)=>a-b;
const nums=items=>items.map(f=>f.n).sort(asc);
function rankFacts(rows,max,part,weights){
  const count=(sample,n)=>sample.reduce((s,d)=>s+Number(d[part].includes(n)),0);
  const facts=Array.from({length:max},(_,i)=>{
    const n=i+1, ten=count(rows.slice(0,10),n),lastTen=count(rows.slice(10,20),n);
    const thirty=count(rows.slice(0,30),n),long=count(rows.slice(0,120),n);
    const miss=rows.findIndex(d=>d[part].includes(n));
    return {n,ten,thirty,long,miss:miss<0?rows.length:miss,change:ten-lastTen,freq:thirty+30*long/Math.min(120,rows.length)};
  });
  for(const f of facts){
    // Ties receive the same rank; numeric order only breaks the final tie.
    f.frequencyRank=1+facts.filter(x=>x.freq>f.freq).length;
    f.trendRank=1+facts.filter(x=>x.change>f.change).length;
    f.score=1-(weights[0]*(f.frequencyRank-1)+weights[1]*(f.trendRank-1))/(max-1);
  }
  return facts.sort((a,b)=>b.score-a.score||a.n-b.n);
}
function shaped(pool,size,gold,shape,weight){
  const chosen=pool.filter(f=>gold.includes(f.n)),left=pool.filter(f=>!gold.includes(f.n));
  while(chosen.length<size){
    const step=chosen.length+1,zoneCounts=[0,0,0],odd=chosen.filter(f=>f.n%2).length;
    chosen.forEach(f=>zoneCounts[shape.zone(f.n)]++);
    const merit=f=>{
      const z=shape.zone(f.n);
      const cost=Math.abs(zoneCounts[z]+1-step*shape.shares[z])-Math.abs(zoneCounts[z]-step*shape.shares[z]);
      return f.score-weight*(cost+.5*Math.abs(odd+f.n%2-step*shape.odd));
    };
    left.sort((a,b)=>merit(b)-merit(a)||a.n-b.n);
    chosen.push(left.shift());
  }
  return chosen;
}
export function integrated(rows,game,mode,{useGold=true,outer=true}={}){
  const ssq=game==='ssq',mainMax=ssq?33:35,k=ssq?6:5,weights=params[mode];
  const ranked=rankFacts(rows,mainMax,'main',weights),rear=rankFacts(rows,ssq?16:12,'extra',weights);
  const zone=n=>Math.min(2,Math.floor((n-1)/(ssq?11:12))),sample=rows.slice(0,30).flatMap(d=>d.main);
  const shape={zone,shares:[0,1,2].map(z=>sample.filter(n=>zone(n)===z).length/sample.length),odd:sample.filter(n=>n%2).length/sample.length};
  const big=ranked.slice(0,23),mid=shaped(outer?big:ranked,15,[],shape,weights[2]);
  const candidates=[];
  for(const z of [0,1,2]){
    const [f,second]=mid.filter(x=>zone(x.n)===z).sort((a,b)=>b.score-a.score||a.n-b.n);
    if(f&&second&&f.frequencyRank<=10&&f.change>0&&f.score-second.score>=.04)candidates.push(f);
  }
  candidates.sort((a,b)=>b.score-a.score||a.n-b.n);
  const cap=candidates.length===3&&candidates.every(f=>f.frequencyRank<=6&&f.change>=2)?3:2;
  const gold=useGold?nums(candidates.slice(0,cap)):[];
  const budget=shaped(mid,k+2,gold,shape,weights[2]),single=shaped(budget,k,gold,shape,weights[2]);
  const stages=[big,mid,budget,single].map((p,i)=>({main:nums(p),extra:nums(rear.slice(0,[6,4,ssq?2:3,ssq?1:2][i]))}));
  return {gold,stages,ranked,rear,shares:shape.shares,odd:shape.odd};
}
