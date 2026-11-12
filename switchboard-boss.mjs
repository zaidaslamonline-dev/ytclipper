export const SWITCHBOARD_BOSS_KEY='stickcity-switchboard-boss-v1';
export const SWITCHBOARD_HIDEOUT=Object.freeze({districtId:'signal',x:0,z:-67.1});
export const SWITCHBOARD_PYLONS=Object.freeze([
 Object.freeze({id:'west-array',label:'West Signal Array',x:-3.55,z:-64.65,color:0x55d5e8}),
 Object.freeze({id:'east-array',label:'East Signal Array',x:3.55,z:-64.65,color:0xd8a2ff})
]);
const IDS=new Set(SWITCHBOARD_PYLONS.map(x=>x.id));
const CHOICES={broadcast:new Set(['protect-witness','publish-receipt']),contain:new Set(['share-key','burn-key'])};
const clamp=(v,a,b,d=a)=>{const n=Number(v);return Number.isFinite(n)?Math.min(b,Math.max(a,n)):d;};
const time=v=>clamp(v,0,1e9,0),valid=(b,c)=>!!CHOICES[b]&&CHOICES[b].has(c);
const memo=(tag,label,at)=>({tag,label,at:time(at)});
export function createInitialSwitchboardBossState(){return{version:1,unlocked:false,branch:null,aftermathChoice:null,phase:'locked',pylons:[],hp:0,pulseState:'idle',pulseAt:null,recoveryUntil:null,nextPulseAt:null,startedAt:null,completedAt:null,memories:[]};}
export function normalizeSwitchboardBossState(v){
 if(!v||typeof v!=='object'||v.version!==1)return null;
 if(v.unlocked!==true||!valid(v.branch,v.aftermathChoice))return createInitialSwitchboardBossState();
 const pylons=Array.isArray(v.pylons)?[...new Set(v.pylons.filter(id=>IDS.has(id)))]:[];
 let phase=['shielded','jammer','core','victory'].includes(v.phase)?v.phase:'shielded';
 if(pylons.length<2)phase='shielded';else if(phase==='shielded')phase='jammer';
 const max=phase==='core'?64:phase==='victory'?0:100;
 const pulse=['idle','telegraph','recovery'].includes(v.pulseState)&&['jammer','core'].includes(phase)?v.pulseState:'idle';
 const memories=Array.isArray(v.memories)?v.memories.filter(x=>x&&typeof x.label==='string').slice(-8).map(x=>({tag:typeof x.tag==='string'?x.tag.slice(0,64):'switchboard-memory',label:x.label.slice(0,180),at:time(x.at)})):[];
 return{version:1,unlocked:true,branch:v.branch,aftermathChoice:v.aftermathChoice,phase,pylons,hp:phase==='victory'?0:clamp(v.hp,0,max,max),pulseState:pulse,pulseAt:pulse==='telegraph'?time(v.pulseAt):null,recoveryUntil:pulse==='recovery'?time(v.recoveryUntil):null,nextPulseAt:pulse==='idle'&&['jammer','core'].includes(phase)&&v.nextPulseAt!=null?time(v.nextPulseAt):null,startedAt:time(v.startedAt),completedAt:phase==='victory'?time(v.completedAt):null,memories};
}
export function unlockSwitchboardBoss(current,pursuit,cityTime=0){
 const s=normalizeSwitchboardBossState(current)||createInitialSwitchboardBossState();
 if(s.unlocked||!pursuit||pursuit.completed!==true||!valid(pursuit.branch,pursuit.aftermathChoice))return s;
 return normalizeSwitchboardBossState({...createInitialSwitchboardBossState(),unlocked:true,branch:pursuit.branch,aftermathChoice:pursuit.aftermathChoice,phase:'shielded',startedAt:time(cityTime),memories:[memo('hideout-located','The three relay fragments exposed the Switchboard’s hidden mast hideout',cityTime)]});
}
export function getSwitchboardBossLane(current,cityTime=0){
 const s=normalizeSwitchboardBossState(current);if(!s?.unlocked)return null;
 const seed=(s.branch==='contain'?1:0)+(['publish-receipt','burn-key'].includes(s.aftermathChoice)?1:0);
 return(Math.floor(time(cityTime)/4.4)+seed)%2===0?'left':'right';
}
export function getSwitchboardBossPlan(current,cityTime=0){
 const s=normalizeSwitchboardBossState(current);
 if(!s?.unlocked)return{phase:'locked',label:'HIDEOUT UNKNOWN',objective:'Decode all three operator relays to locate the hidden mast.',hp:0,maxHp:0,pulseState:'idle',lane:null,pylonsRemaining:[...IDS]};
 const p={shielded:['SIGNAL SHIELD','Disable both signal arrays. The operator is protected by the mast field.'],jammer:['JAMMER CORE','Guard or jump through the pulse, then punch during the recovery window.'],core:['DECOY CORE','Move to the active side lane and strike during the recovery window.'],victory:['OPERATOR DEFEATED','The mast is quiet. The Switchboard’s route is finally exposed.']}[s.phase];
 return{phase:s.phase,label:p[0],objective:p[1],hp:s.hp,maxHp:s.phase==='core'?64:s.phase==='victory'?0:100,pulseState:s.pulseState,lane:s.phase==='core'?getSwitchboardBossLane(s,cityTime):null,pylonsRemaining:SWITCHBOARD_PYLONS.filter(x=>!s.pylons.includes(x.id)).map(x=>x.id)};
}
export function interactSwitchboardPylon(current,id,cityTime=0){
 const s=normalizeSwitchboardBossState(current)||createInitialSwitchboardBossState();
 if(!s.unlocked)return{ok:false,reason:'locked',state:s};
 if(s.phase!=='shielded')return{ok:false,reason:'arrays-already-disabled',state:s};
 if(!IDS.has(id))return{ok:false,reason:'unknown-array',state:s};
 if(s.pylons.includes(id))return{ok:false,reason:'already-disabled',state:s};
 const p=SWITCHBOARD_PYLONS.find(x=>x.id===id),pylons=[...s.pylons,id],exposed=pylons.length===2;
 const state=normalizeSwitchboardBossState({...s,pylons,phase:exposed?'jammer':'shielded',hp:100,pulseState:'idle',pulseAt:null,recoveryUntil:null,nextPulseAt:exposed?time(cityTime)+2.4:null,memories:[...s.memories,memo('array-disabled-'+id,'You disabled the '+p.label+' and weakened the mast shield',cityTime)]});
 return{ok:true,state,pylon:p,exposed,message:exposed?'BOTH ARRAYS DOWN · THE SWITCHBOARD IS EXPOSED. WATCH THE PULSE.':p.label.toUpperCase()+' DISABLED · ONE ARRAY REMAINS.'};
}
export function tickSwitchboardBoss(current,cityTime=0,{blocking=false,airborne=false}={}){
 const s=normalizeSwitchboardBossState(current)||createInitialSwitchboardBossState();
 if(!s.unlocked||!['jammer','core'].includes(s.phase))return{state:s,events:[],playerDamage:0};
 const now=time(cityTime),jam=s.phase==='jammer',wind=jam?1.05:.82,recovery=jam?1.65:1.25,interval=jam?2.3:1.75,damage=jam?12:16;
 const n={...s},events=[];let playerDamage=0;
 if(s.pulseState==='idle'){const due=s.nextPulseAt==null?now+1.1:s.nextPulseAt;if(now>=due){n.pulseState='telegraph';n.pulseAt=now+wind;n.nextPulseAt=null;events.push('telegraph-start');}else if(s.nextPulseAt==null)n.nextPulseAt=due;}
 else if(s.pulseState==='telegraph'&&now>=s.pulseAt){n.pulseState='recovery';n.pulseAt=null;n.recoveryUntil=now+recovery;if(blocking||airborne)events.push('pulse-evaded');else{events.push('pulse-hit');playerDamage=damage;}}
 else if(s.pulseState==='recovery'&&now>=s.recoveryUntil){n.pulseState='idle';n.recoveryUntil=null;n.nextPulseAt=now+interval;events.push('recovery-ended');}
 return{state:normalizeSwitchboardBossState(n),events,playerDamage};
}
export function damageSwitchboardBoss(current,amount,cityTime=0,playerX=0){
 const s=normalizeSwitchboardBossState(current)||createInitialSwitchboardBossState();
 if(!s.unlocked)return{ok:false,reason:'locked',state:s};
 if(s.phase==='shielded')return{ok:false,reason:'shielded',state:s};
 if(s.phase==='victory')return{ok:false,reason:'already-defeated',state:s};
 const now=time(cityTime);
 if(s.pulseState!=='recovery'||s.recoveryUntil==null||now>s.recoveryUntil)return{ok:false,reason:'closed-window',state:s};
 if(s.phase==='core'){const lane=getSwitchboardBossLane(s,now),side=Number(playerX)<-.65?'left':Number(playerX)>.65?'right':'center';if(side!==lane)return{ok:false,reason:'wrong-lane',state:s,lane};}
 const hp=Math.max(0,s.hp-clamp(amount,1,64,1)),memories=[...s.memories];
 if(hp===0&&s.phase==='jammer'){memories.push(memo('decoy-core-exposed','The jammer shell broke and exposed a shifting decoy core',now));return{ok:true,state:normalizeSwitchboardBossState({...s,phase:'core',hp:64,pulseState:'idle',pulseAt:null,recoveryUntil:null,nextPulseAt:now+1.25,memories}),event:'core-exposed',damage:s.hp,message:'JAMMER SHATTERED · THE DECOY CORE IS MOVING.'};}
 if(hp===0&&s.phase==='core'){memories.push(memo('switchboard-defeated','You shut down the Switchboard’s decoy core and ended the signal hunt',now));return{ok:true,state:normalizeSwitchboardBossState({...s,phase:'victory',hp:0,pulseState:'idle',pulseAt:null,recoveryUntil:null,nextPulseAt:null,completedAt:now,memories}),event:'victory',damage:s.hp,message:'THE MAST GOES DARK · THE SWITCHBOARD IS DEFEATED.'};}
 memories.push(memo('boss-hit','You struck the Switchboard during a recovery window',now));
 return{ok:true,state:normalizeSwitchboardBossState({...s,hp,memories}),event:'boss-hit',damage:s.hp-hp,message:'CLEAN COUNTER · '+hp+' CORE INTEGRITY.'};
}
export function getSwitchboardBossSummary(current,cityTime=0){
 const s=normalizeSwitchboardBossState(current);if(!s?.unlocked)return'HIDEOUT LOCKED · DECODE 3/3 RELAYS';
 const p=getSwitchboardBossPlan(s,cityTime);if(s.phase==='shielded')return'HIDEOUT · ARRAYS '+s.pylons.length+'/2';if(s.phase==='victory')return'SWITCHBOARD DEFEATED · MAST SILENT';
 return'BOSS · '+p.label+' · '+s.hp+'/'+p.maxHp+(p.lane?' · LANE '+p.lane.toUpperCase():'');
}
export function loadSwitchboardBossState(storage){if(!storage||typeof storage.getItem!=='function')return null;try{const raw=storage.getItem(SWITCHBOARD_BOSS_KEY);return raw?normalizeSwitchboardBossState(JSON.parse(raw)):null;}catch{return null;}}
export function persistSwitchboardBossState(storage,value){if(!storage||typeof storage.setItem!=='function')return false;const s=normalizeSwitchboardBossState(value);if(!s)return false;try{storage.setItem(SWITCHBOARD_BOSS_KEY,JSON.stringify(s));return true;}catch{return false;}}
