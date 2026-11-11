export const ENEMY_TACTIC_PROFILES = Object.freeze({
  breacher: Object.freeze({ id:'breacher', label:'BREACHER', warning:'BREACHER WIND-UP · GUARD OR JUMP', approachRange:2.55, attackRange:2.2, targetDistance:1.55, speed:1.55, windup:.82, recovery:.62, cooldown:2.25, damage:10, color:0xf0a44b }),
  flanker: Object.freeze({ id:'flanker', label:'CUTTER', warning:'CUTTER FLANKING · WATCH YOUR SIDE', approachRange:2.85, attackRange:2.55, targetDistance:1.85, speed:1.8, windup:.64, recovery:.55, cooldown:2.65, damage:7, color:0x9d83f4 })
});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function createEnemyTacticState(role,side=1){
 if(!ENEMY_TACTIC_PROFILES[role])throw new TypeError('Unknown enemy tactic role: '+role);
 return {role,side:finite(side,1)<0?-1:1,phase:'approach',phaseTimer:0,cooldown:role==='flanker'?.55:0,attacks:0};
}
export function getEnemyTacticalTarget(state,enemyPosition,playerPosition,playerYaw=0){
 const role=ENEMY_TACTIC_PROFILES[state?.role]?state.role:'breacher',profile=ENEMY_TACTIC_PROFILES[role];
 const ex=finite(enemyPosition?.x),ez=finite(enemyPosition?.z),px=finite(playerPosition?.x),pz=finite(playerPosition?.z);
 if(role==='breacher'){const dx=px-ex,dz=pz-ez,distance=Math.hypot(dx,dz);if(distance<=profile.targetDistance)return{x:ex,z:ez};return{x:px-dx/distance*profile.targetDistance,z:pz-dz/distance*profile.targetDistance};}
 const yaw=finite(playerYaw),forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw),rightX=Math.cos(yaw),rightZ=-Math.sin(yaw),side=finite(state?.side,1)<0?-1:1;
 return{x:px+forwardX*.7+rightX*side*profile.targetDistance,z:pz+forwardZ*.7+rightZ*side*profile.targetDistance};
}
export function getEnemyTelegraphProgress(state){
 const profile=ENEMY_TACTIC_PROFILES[state?.role];if(!profile||state.phase!=='telegraph')return 0;
 return clamp(1-finite(state.phaseTimer,profile.windup)/profile.windup,0,1);
}
export function advanceEnemyTactics(currentState,input={},deltaSeconds=0){
 const role=ENEMY_TACTIC_PROFILES[currentState?.role]?currentState.role:'breacher',profile=ENEMY_TACTIC_PROFILES[role];
 const state={role,side:finite(currentState?.side,1)<0?-1:1,phase:['approach','telegraph','recover'].includes(currentState?.phase)?currentState.phase:'approach',phaseTimer:Math.max(0,finite(currentState?.phaseTimer)),cooldown:Math.max(0,finite(currentState?.cooldown)),attacks:Math.max(0,Math.floor(finite(currentState?.attacks)))};
 const dt=clamp(finite(deltaSeconds),0,.1),distance=Math.max(0,finite(input.distance,Infinity)),events=[];
 state.cooldown=Math.max(0,state.cooldown-dt);
 if(state.phase==='telegraph'&&input.interrupted){state.phase='recover';state.phaseTimer=profile.recovery;state.cooldown=Math.max(state.cooldown,profile.cooldown);events.push('interrupted');return{state,events};}
 if(input.interrupted)return{state,events};
 if(state.phase==='approach'){if(distance<=profile.approachRange&&state.cooldown<=0){state.phase='telegraph';state.phaseTimer=profile.windup;events.push('telegraph-start');}return{state,events};}
 if(state.phase==='telegraph'){
  if(input.airborne||distance>profile.attackRange+.35){state.phase='recover';state.phaseTimer=profile.recovery;state.cooldown=Math.max(state.cooldown,profile.cooldown);events.push('missed');return{state,events};}
  state.phaseTimer=Math.max(0,state.phaseTimer-dt);
  if(state.phaseTimer<=0){state.phase='recover';state.phaseTimer=profile.recovery;state.cooldown=Math.max(state.cooldown,profile.cooldown);state.attacks+=1;events.push(input.blocking?'blocked':'hit');}
  return{state,events};
 }
 state.phaseTimer=Math.max(0,state.phaseTimer-dt);if(state.phaseTimer<=0)state.phase='approach';return{state,events};
}
