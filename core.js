/* 双彩研究工作台 V12 — 数据层。无第三方运行时依赖。 */
export const VERSION='12.0.0';
export const POLICY='research-v12.1';
export const GAMES={
 ssq:{name:'双色球',mainName:'红球',extraName:'蓝球',mainMax:33,extraMax:16,mainCount:6,extraCount:1},
 dlt:{name:'超级大乐透',mainName:'前区',extraName:'后区',mainMax:35,extraMax:12,mainCount:5,extraCount:2}
};
export function newState(){return {schema:12,draws:{ssq:[],dlt:[]},tickets:{ssq:[],dlt:[]},records:[],meta:{lastSync:'',status:'未同步',provenance:{},quarantine:[],migration:''},settings:{window:60,train:60,test:60}}}
export const pad=n=>String(n).padStart(2,'0');
export const numsText=xs=>(xs||[]).map(pad).join(' ');
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0')};
export function canonicalIssue(input,date=''){
 const raw=String(input??'').trim();if(!/^\d{5}$|^\d{7}$/.test(raw))throw Error('期号必须为5位或7位数字');
 const full=raw.length===5?`20${raw}`:raw;
 const year=Number(full.slice(0,4)),seq=Number(full.slice(4));
 if(year<2000||year>2100||seq<1||seq>366)throw Error('期号年份或序号异常');
 if(date&&Number(date.slice(0,4))!==year)throw Error('期号年份与开奖日期不一致');
 return full;
}
export function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s&&d.getTime()<Date.now()+2*864e5}
function arr(input){if(Array.isArray(input))return input.map(Number);if(typeof input==='string')return input.trim().split(/[\s,、，;；|+]+/).filter(Boolean).map(Number);return []}
export function validBalls(main,extra,game){const r=GAMES[game];return !!r&&Array.isArray(main)&&Array.isArray(extra)&&main.length===r.mainCount&&extra.length===r.extraCount&&new Set(main).size===main.length&&new Set(extra).size===extra.length&&main.every(n=>Number.isInteger(n)&&n>=1&&n<=r.mainMax)&&extra.every(n=>Number.isInteger(n)&&n>=1&&n<=r.extraMax)}
export function normalizeDraw(item,game,source='未注明来源'){
 if(!GAMES[game]||!item||typeof item!=='object')throw Error('开奖记录结构异常');
 const date=String(item.date||item.lotteryDrawTime||'').slice(0,10);if(!validDate(date))throw Error('开奖日期无效');
 const issue=canonicalIssue(item.issue??item.lotteryDrawNum??item.drawIssue,date);
 const main=arr(item.main??(game==='ssq'?item.red:item.front)).sort((a,b)=>a-b);
 const extra=arr(item.extra??(game==='ssq'?item.blue:item.back)).sort((a,b)=>a-b);
 if(!validBalls(main,extra,game))throw Error('号码范围/数量/重复检查失败');
 const src=String(source||item.source||'未注明来源').slice(0,90);
 const sources=Array.isArray(item.sources)?item.sources.filter(x=>typeof x==='string').slice(0,4):[src];
 const verification=['cross-checked','single-source','manual-import'].includes(item.verification)?item.verification:'single-source';
 return {game,issue,date,main,extra,sources,verification};
}
export const sameDraw=(a,b)=>a.issue===b.issue&&a.date===b.date&&a.main.join(',')===b.main.join(',')&&a.extra.join(',')===b.extra.join(',');
export function auditIssues(rows){let gaps=0,dups=0;const set=new Set();for(let i=0;i<rows.length;i++){const x=rows[i];if(set.has(x.issue))dups++;set.add(x.issue);if(i&&rows[i-1].issue.slice(0,4)===x.issue.slice(0,4)&&Number(rows[i-1].issue.slice(4))-Number(x.issue.slice(4))>1)gaps++}return {suspectedGaps:gaps,duplicates:dups}}
export function mergeDraws(existing,incoming,game,opts={}){
 const map=new Map(),quarantine=[],report={added:0,verified:0,unchanged:0,conflicts:0,invalid:0};
 for(const raw of existing||[]){try{const d=normalizeDraw(raw,game,raw?.sources?.[0]||'历史本机数据');map.set(d.issue,d)}catch(e){report.invalid++}}
 const seen=new Map(),invalidIssues=new Set();for(const item of incoming||[]){let d;try{d=normalizeDraw(item,game,opts.source||item.source||'外部数据')}catch(e){report.invalid++;continue}const prev=seen.get(d.issue);if(prev&&!sameDraw(prev,d)){invalidIssues.add(d.issue);report.conflicts++;quarantine.push({issue:d.issue,game,reason:'同一来源同一期出现不同号码，整期隔离'});}else if(!prev)seen.set(d.issue,d)}
 for(const [issue,d] of seen){if(invalidIssues.has(issue))continue;const old=map.get(d.issue);if(!old){map.set(d.issue,d);report.added++;continue}
 if(!sameDraw(old,d)){report.conflicts++;quarantine.push({issue:d.issue,game,reason:'历史记录与新来源不一致'});continue}
 const sources=[...new Set([...(old.sources||[]),...(d.sources||[])])].slice(0,5);
 const ver=(old.verification==='cross-checked'||d.verification==='cross-checked')?'cross-checked':old.verification==='manual-import'?'manual-import':d.verification;
 if(ver==='cross-checked'&&old.verification!=='cross-checked')report.verified++;
 map.set(d.issue,{...old,sources,verification:ver});report.unchanged++;
 }
 const rows=[...map.values()].sort((a,b)=>b.issue.localeCompare(a.issue));return {rows,quarantine,report,...auditIssues(rows)};
}
export function safeTicket(raw,g){if(!raw||typeof raw!=='object')return null;const main=arr(raw.main).sort((a,b)=>a-b),extra=arr(raw.extra).sort((a,b)=>a-b);if(!validBalls(main,extra,g))return null;return {id:String(raw.id||hash(`${g}/${main}/${extra}/${raw.created||''}`)).slice(0,64),game:g,main,extra,created:String(raw.created||new Date().toISOString()).slice(0,40),startIssue:(()=>{try{return raw.startIssue?canonicalIssue(raw.startIssue):''}catch{return ''}})(),note:String(raw.note||'').slice(0,200),active:raw.active!==false}}
export function safeRecord(raw){if(!raw||typeof raw!=='object'||!GAMES[raw.game])return null;let baseIssue;try{baseIssue=canonicalIssue(raw.baseIssue||raw.issue||'',String(raw.baseDate||''))}catch{return null}
 if(!Array.isArray(raw.picks)||raw.picks.length<1||raw.picks.length>4)return null;
 const picks=raw.picks.map(p=>{const t=safeTicket(p,raw.game);if(!t)return null;const legacyMode=raw.policy||raw.model||'旧版';const mode=p.mode==='trend'&&legacyMode==='dual-v9'?'analyst':p.mode;return {mode:['analyst','veteran','trend','random'].includes(mode)?mode:'analyst',main:t.main,extra:t.extra,explanations:Array.isArray(p.explanations)?p.explanations.map(x=>String(x).slice(0,300)).slice(0,20):[],bans:{main:Array.isArray(p.bans?.main)?p.bans.main.filter(n=>Number.isInteger(n)&&n>=1&&n<=GAMES[raw.game].mainMax).slice(0,24):[],extra:Array.isArray(p.bans?.extra)?p.bans.extra.filter(n=>Number.isInteger(n)&&n>=1&&n<=GAMES[raw.game].extraMax).slice(0,10):[]},killContext:p.killContext&&typeof p.killContext==='object'?{method:['cold','hot','miss'].includes(p.killContext.method)?p.killContext.method:'cold',window:Math.max(0,Math.min(200,Number(p.killContext.window)||0))}:null}});if(picks.some(x=>!x))return null;
 const time=new Date(raw.lockedAt);if(!Number.isFinite(time.getTime()))return null;
 return {id:String(raw.id||hash(JSON.stringify({baseIssue,picks,time}))).slice(0,64),game:raw.game,baseIssue,lockedAt:time.toISOString(),snapshotHash:String(raw.snapshotHash||'').slice(0,64),window:Math.max(0,Math.min(1000,Number(raw.window)||0)),policy:String(raw.policy||'旧版记录').slice(0,50),picks,localOnly:true};
}
export function migrateLegacy(legacy={},legacyResearch=[]){const s=newState();for(const g of Object.keys(GAMES)){s.draws[g]=mergeDraws([],legacy.draws?.[g]||[],g).rows;s.tickets[g]=(legacy.tickets?.[g]||[]).slice(0,10000).map(x=>safeTicket(x,g)).filter(Boolean)}s.records=(Array.isArray(legacyResearch)?legacyResearch:[]).slice(0,5000).map(safeRecord).filter(Boolean);s.meta.migration='已检查并迁移本机旧版本记录（无效项目已跳过）';return s}
function validateState(raw){const s=newState();if(!raw||typeof raw!=='object')return s;for(const g of Object.keys(GAMES)){s.draws[g]=mergeDraws([],raw.draws?.[g]||[],g).rows;s.tickets[g]=(Array.isArray(raw.tickets?.[g])?raw.tickets[g]:[]).slice(0,15000).map(x=>safeTicket(x,g)).filter(Boolean)}s.records=(Array.isArray(raw.records)?raw.records:[]).slice(0,10000).map(safeRecord).filter(Boolean);if(raw.meta&&typeof raw.meta==='object')s.meta={...s.meta,lastSync:String(raw.meta.lastSync||'').slice(0,40),status:String(raw.meta.status||'').slice(0,150),quarantine:Array.isArray(raw.meta.quarantine)?raw.meta.quarantine.slice(-150):[],provenance:raw.meta.provenance&&typeof raw.meta.provenance==='object'?raw.meta.provenance:{},migration:String(raw.meta.migration||'').slice(0,140)};if(raw.settings&&typeof raw.settings==='object')s.settings={window:[30,60,100,200].includes(Number(raw.settings.window))?Number(raw.settings.window):60,train:[30,60,100].includes(Number(raw.settings.train))?Number(raw.settings.train):60,test:[20,40,60,120].includes(Number(raw.settings.test))?Number(raw.settings.test):60};return s}
let db=null;let storageMode='IndexedDB';
export function storageName(){return storageMode}
export async function loadState(){let raw=null;try{db=await new Promise((res,rej)=>{const req=indexedDB.open('lottery_v12',1);req.onupgradeneeded=()=>req.result.createObjectStore('app');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});raw=await new Promise((res,rej)=>{const req=db.transaction('app').objectStore('app').get('state');req.onsuccess=()=>res(req.result||null);req.onerror=()=>rej(req.error)})}catch(e){storageMode='localStorage 后备';db=null;try{raw=JSON.parse(localStorage.getItem('lottery_v12_state')||'null')}catch{}}
 if(raw)return validateState(raw);
 try{const old=JSON.parse(localStorage.getItem('lottery_v5_local_1')||'null');const research=JSON.parse(localStorage.getItem('lottery_v10_research_1')||'[]');if(old||research?.length)return migrateLegacy(old||{},research)}catch{}
 return newState();
}
export async function saveState(s){if(db){try{await new Promise((res,rej)=>{const tx=db.transaction('app','readwrite');tx.objectStore('app').put(s,'state');tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});return}catch(e){storageMode='localStorage 后备';db=null}}
 try{localStorage.setItem('lottery_v12_state',JSON.stringify(s))}catch(e){throw Error('本机数据保存失败（可能存储空间不足），请先导出备份')}
}
export function csvParse(text){const lines=[],cols=[];let field='',row=[],quote=false;const t=String(text).replace(/^\uFEFF/,'');for(let i=0;i<t.length;i++){const ch=t[i];if(ch==='"'){if(quote&&t[i+1]==='"'){field+='"';i++}else quote=!quote}else if(ch===','&&!quote){row.push(field);field=''}else if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&t[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))lines.push(row);row=[]}else field+=ch}if(quote)throw Error('CSV 引号未闭合');row.push(field);if(row.some(x=>x.trim()))lines.push(row);return lines}
export function parseCSV(text){const lines=csvParse(text),out={ssq:[],dlt:[]},errors=[];for(let i=0;i<lines.length;i++){const x=lines[i];if(i===0&&/^(game|彩种)$/i.test(x[0]?.trim()))continue;try{const g=/^(ssq|双色球)$/i.test(x[0])?'ssq':/^(dlt|大乐透|超级大乐透)$/i.test(x[0])?'dlt':null;if(!g)throw Error('彩种应为 ssq / dlt');if(x.length<5)throw Error('需要 game,issue,date,main,extra 五列');out[g].push(normalizeDraw({issue:x[1],date:x[2],main:x[3],extra:x[4]},g,'手工 CSV'))}catch(e){if(errors.length<20)errors.push(`第${i+1}行：${e.message}`)}}return {out,errors,total:lines.length}}
export function fullBackup(s){return {format:'lottery-workbench-v12',exportedAt:new Date().toISOString(),disclaimer:'本机锁定记录并非第三方不可篡改证明',state:s}}
export function parseBackup(value){if(!value||!value.state)throw Error('备份缺少有效 state');if(value.format==='lottery-workbench-v12')return validateState(value.state);if(value.format==='lottery-v5')return migrateLegacy(value.state,[]);throw Error('不支持的备份格式：请使用 V12 或旧版 lottery-v5 完整备份')}
export function downloadFile(filename,content,type='application/json'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
const MIRRORS=['https://cdn.jsdelivr.net/gh/yangxb919/lottery-data@main/data/','https://raw.githubusercontent.com/yangxb919/lottery-data/main/data/'];
async function getJSON(url,timeout=18000){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
export async function syncData(s){const reports=[],errors=[];let local=null;const snapshots=[];if(typeof location!=='undefined'&&location.hostname.endsWith('.github.io')){const owner=location.hostname.split('.')[0],repo=location.pathname.split('/').filter(Boolean)[0];if(/^[a-zA-Z0-9_-]+$/.test(owner)&&/^[a-zA-Z0-9_.-]+$/.test(repo)){snapshots.push(`https://raw.githubusercontent.com/${owner}/${repo}/main/data/history.json?v=${Date.now()}`);snapshots.push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/data/history.json?v=${Date.now()}`)}}snapshots.push('./data/history.json?v='+Date.now());for(const u of snapshots){try{local=await getJSON(u,10000);if(local&&Array.isArray(local.ssq)&&Array.isArray(local.dlt))break;local=null}catch(e){}}if(!local)errors.push('尚无自动同步数据快照，改用第三方单源历史库');
 for(const g of Object.keys(GAMES)){let raw=null,src='';if(local&&Array.isArray(local[g])){raw=local[g];src='GitHub Actions 本站快照'}else{for(const mirror of MIRRORS){try{raw=await getJSON(mirror+g+'.json?v='+Math.floor(Date.now()/3600000));src='第三方公开历史仓库（CDN / raw 仅为同源镜像）';break}catch(e){errors.push(`${g} 镜像访问失败：${String(e.message).slice(0,50)}`)}}}
 if(!Array.isArray(raw)||raw.length<20){errors.push(`${g} 无有效历史数据（至少20期）`);continue}
 const normalized=[],sourceVerification=local?.provenance?.[g]||{};
 for(const x of raw){try{const row=normalizeDraw(x,g,src);if(local&&x.verification==='cross-checked')row.verification='cross-checked';normalized.push(row)}catch{}}
 if(normalized.length<20){errors.push(`${g} 数据合法性校验失败`);continue}
 const merged=mergeDraws(s.draws[g],normalized,g,{source:src});s.draws[g]=merged.rows;
 s.meta.quarantine=[...s.meta.quarantine,...merged.quarantine].slice(-150);
 s.meta.provenance[g]={source:src,verification:src.startsWith('GitHub')?String(sourceVerification.status||'逐期核验状态详见数据详情'):'未独立核验',latest:merged.rows[0]?.issue||'',count:merged.rows.length,updated:new Date().toISOString(),suspectedGaps:merged.suspectedGaps,conflicts:merged.report.conflicts};
 reports.push(`${GAMES[g].name} ${merged.rows.length}期、新增${merged.report.added}期、冲突${merged.report.conflicts}条`);
 }
 if(reports.length){s.meta.lastSync=new Date().toISOString();s.meta.status=reports.join('；')}
 return {reports,errors};
}
