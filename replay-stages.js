import {jointPlan,JOINT} from './joint-rule.js';
import {acceptedFactor} from './joint-config.js';
import {integrated} from './unified-rule.js';
import {legacyPlan,hits,modes,processPolicy} from './selection-engine.js';
export function replayStages(rows,game){
  if(rows.length<330)throw Error('回测需要连续的 330 期历史');
  const draws=rows.slice(0,30).map((actual,i)=>{
    const training=rows.slice(i+1,i+301);
    if(training.some(d=>d.date>=actual.date))throw Error('历史期次顺序异常');
    const byMode={},audit={};
    for(const mode of modes){
      const p=integrated(training,game,mode),without=integrated(training,game,mode,{useGold:false});
      const direct=integrated(training,game,mode,{outer:false});
      const old=legacyPlan(training,game,mode);
      const extra=[...old.compound.extra,p.rear.find(f=>!old.compound.extra.includes(f.n)).n].sort((a,b)=>a-b);
      const score=t=>({...t,hits:hits(t,actual)});
      byMode[mode]=p.stages.slice(1).map(score);
      audit[mode]={outer:score(p.stages[0]),gold:p.gold,noGold:without.stages.slice(-2).map(score),
        direct:score(direct.stages[3]),old:[score({main:old.compound.main,extra}),score({main:old.single.main,extra:old.single.extra})],
        facts:p.ranked.map(f=>[f.n,f.frequencyRank,f.trendRank,+f.score.toFixed(3)]),shares:p.shares};
    }
    return {joint:jointPlan(training,game,{factor:acceptedFactor[game]}),issue:actual.issue,date:actual.date,main:actual.main,extra:actual.extra,base:training[0].issue,byMode,audit};
  });
  return {game,jointRule:JOINT,policy:processPolicy,draws};
}
