import { CREW_PROFILES, getRoutineTarget } from './crew-system.mjs';

export const CREW_LIFE_SLOT_SECONDS = 22;
export const CREW_LIFE_CYCLE_SECONDS = CREW_LIFE_SLOT_SECONDS * 3;

export const CREW_LIFE_PLANS = Object.freeze({
  milo: Object.freeze([
    Object.freeze({ label: 'MAPPING PATROLS', description: 'Mapping patrol routes around the block', pose: 'plan' }),
    Object.freeze({ label: 'CHECKING SUBWAY TIMES', description: 'Checking the subway timings and relay traffic', pose: 'scan' }),
    Object.freeze({ label: 'READING THE HEADLINES', description: 'Reading the latest neighbourhood headlines', pose: 'read' })
  ]),
  ria: Object.freeze([
    Object.freeze({ label: 'TALKING WITH COMMUTERS', description: 'Talking with commuters at the station', pose: 'talk' }),
    Object.freeze({ label: 'CHECKING ON SHOP OWNERS', description: 'Checking on the shop owners along the block', pose: 'listen' }),
    Object.freeze({ label: 'ORGANIZING THE BLOCK', description: 'Organizing the neighbourhood updates', pose: 'organize' })
  ]),
  bo: Object.freeze([
    Object.freeze({ label: 'TRAINING BY THE WATER', description: 'Training beside the waterfront steps', pose: 'train' }),
    Object.freeze({ label: 'RUNNING COURT DRILLS', description: 'Running basketball drills at the court', pose: 'practice' }),
    Object.freeze({ label: 'CATCHING UP WITH LOCALS', description: 'Catching up with regulars at the diner', pose: 'social' })
  ])
});

const WALK_SPEEDS = Object.freeze({ milo: 1.18, ria: 1.28, bo: 1.46 });

function safeElapsed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1e9, Math.max(0, number)) : 0;
}

export function getCrewLifeState(npcId, elapsedSeconds = 0) {
  const profile = CREW_PROFILES[npcId];
  const plan = CREW_LIFE_PLANS[npcId];
  if (!profile || !plan) return null;

  const elapsed = safeElapsed(elapsedSeconds);
  const route = getRoutineTarget(npcId, elapsed);
  if (!route) return null;

  const index = route.index % plan.length;
  const nextIndex = (index + 1) % plan.length;
  const slotElapsed = elapsed % CREW_LIFE_SLOT_SECONDS;
  const nextStop = profile.routine[nextIndex];

  return {
    npcId,
    ...route,
    activity: plan[index].label,
    activityDescription: plan[index].description,
    idlePose: plan[index].pose,
    walkSpeed: WALK_SPEEDS[npcId],
    schedulePhase: slotElapsed < 15 ? 'commute' : 'at-stop',
    nextPlace: nextStop.place,
    nextActivity: plan[nextIndex].label,
    secondsUntilNext: Math.max(1, Math.ceil(CREW_LIFE_SLOT_SECONDS - slotElapsed)),
    cycle: Math.floor(elapsed / CREW_LIFE_CYCLE_SECONDS)
  };
}
