export const ANTAGONIST_KEY = 'stickcity-antagonist-v1';
export const ANTAGONIST_CYCLE_SECONDS = 192;
export const ANTAGONIST_SLOT_SECONDS = 48;

const BRANCH_CHOICES = Object.freeze({
  broadcast: new Set(['protect-witness', 'publish-receipt']),
  contain: new Set(['share-key', 'burn-key'])
});

const ROUTES = Object.freeze([
  Object.freeze({ slot: 0, districtId: 'midtown', place: 'Corner Diner', x: 4.6, z: 10.8, baseActivity: 'AUDITING THE BLOCK' }),
  Object.freeze({ slot: 1, districtId: 'transit', place: 'Transit Plaza', x: -4.8, z: -27.2, baseActivity: 'SWAPPING A SHADOW RELAY' }),
  Object.freeze({ slot: 2, districtId: 'riverside', place: 'Riverside Walk', x: 5.5, z: -43.2, baseActivity: 'FOLLOWING THE RIVER ECHO' }),
  Object.freeze({ slot: 3, districtId: 'signal', place: 'Broadcast Mast', x: -4.6, z: -63.1, baseActivity: 'LISTENING ABOVE THE ROOFLINE' })
]);

const BRANCH_PROFILES = Object.freeze({
  broadcast: Object.freeze({
    'protect-witness': Object.freeze({
      line: 'The witness is moving. You cannot protect everyone by keeping them quiet.',
      activities: ['MAPPING THE WITNESS ROUTE', 'CHECKING THE PUBLIC RECEIPT', 'FOLLOWING THE RIVER ECHO', 'LISTENING ABOVE THE ROOFLINE']
    }),
    'publish-receipt': Object.freeze({
      line: 'You put the receipt in public. Paper travels slowly; signals do not.',
      activities: ['SCRUBBING THE RECEIPT TRAIL', 'RELAYING THE PUBLIC COPY', 'TRACKING WHO READ THE PROOF', 'LISTENING ABOVE THE ROOFLINE']
    })
  }),
  contain: Object.freeze({
    'share-key': Object.freeze({
      line: 'Milo has a key. Keys are promises with teeth.',
      activities: ['TESTING THE CREW’S SHADOW KEY', 'TRACING MILO’S RELAY', 'FOLLOWING THE RIVER ECHO', 'LISTENING ABOVE THE ROOFLINE']
    }),
    'burn-key': Object.freeze({
      line: 'Bo burned a copy. He did not burn the original route.',
      activities: ['SEARCHING FOR THE ORIGINAL ROUTE', 'SWAPPING A SHADOW RELAY', 'CHECKING THE RIVER RECEIVER', 'LISTENING ABOVE THE ROOFLINE']
    })
  })
});

const ACTIONS = Object.freeze({
  shadow: Object.freeze({ intel: 1, heat: 4, decoys: 0, tag: 'operator-tailed', label: 'You followed The Switchboard without revealing the crew’s position', message: 'SIGNAL TRACE COPIED · The operator did not see you leave.' }),
  confront: Object.freeze({ intel: 2, heat: 16, decoys: 0, tag: 'operator-confronted', label: 'You confronted The Switchboard in the open and forced a data drop', message: 'DATA DROP RECOVERED · The operator now knows your face.' }),
  decoy: Object.freeze({ intel: 0, heat: -12, decoys: 1, tag: 'operator-decoy', label: 'You planted a false route and lowered the operator’s attention', message: 'FALSE ROUTE PLANTED · The signal trail goes cold for now.' })
});

const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const safeTime = value => clamp(value, 0, 1e9, 0);
const validBranch = value => value === 'broadcast' || value === 'contain';
const validChoice = (branch, choice) => validBranch(branch) && BRANCH_CHOICES[branch].has(choice);

export function createInitialAntagonistState() {
  return {
    version: 1, unlocked: false, branch: null, aftermathChoice: null,
    intel: 0, heat: 0, decoys: 0, encounters: 0,
    seenEncounters: [], lastMemory: null, memories: []
  };
}

export function normalizeAntagonistState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return null;
  const unlocked = value.unlocked === true && validChoice(value.branch, value.aftermathChoice);
  const branch = unlocked ? value.branch : null;
  const aftermathChoice = unlocked ? value.aftermathChoice : null;
  const seenEncounters = Array.isArray(value.seenEncounters)
    ? [...new Set(value.seenEncounters.filter(item => typeof item === 'string' && /^\d+:\d+$/.test(item)).map(item => item.slice(0, 32)))].slice(-64)
    : [];
  const memories = Array.isArray(value.memories)
    ? value.memories.filter(item => item && typeof item.label === 'string')
      .slice(-8)
      .map(item => ({
        tag: typeof item.tag === 'string' ? item.tag.slice(0, 48) : 'operator-memory',
        label: item.label.slice(0, 180),
        at: safeTime(item.at)
      }))
    : [];
  return {
    version: 1, unlocked, branch, aftermathChoice,
    intel: Math.floor(clamp(value.intel, 0, 3, 0)),
    heat: Math.round(clamp(value.heat, 0, 100, 0)),
    decoys: Math.floor(clamp(value.decoys, 0, 999, 0)),
    encounters: Math.floor(clamp(value.encounters, 0, 1e6, 0)),
    seenEncounters,
    lastMemory: typeof value.lastMemory === 'string' ? value.lastMemory.slice(0, 48) : null,
    memories
  };
}

export function activateAntagonist(current, branch, aftermathChoice) {
  const state = normalizeAntagonistState(current) || createInitialAntagonistState();
  if (state.unlocked || !validChoice(branch, aftermathChoice)) return state;
  const initialHeat = branch === 'broadcast'
    ? (aftermathChoice === 'publish-receipt' ? 22 : 12)
    : (aftermathChoice === 'share-key' ? 18 : 8);
  return { ...state, unlocked: true, branch, aftermathChoice, intel: 0, heat: initialHeat, decoys: 0, encounters: 0, seenEncounters: [], lastMemory: null, memories: [] };
}

export function getAntagonistStage(current) {
  const state = normalizeAntagonistState(current);
  if (!state?.unlocked) return 'unknown';
  if (state.heat >= 65) return 'hunted';
  if (state.intel >= 3) return 'exposed';
  if (state.intel >= 1) return 'traced';
  return 'watching';
}

export function getAntagonistPlan(current, cityTime = 0) {
  const state = normalizeAntagonistState(current);
  if (!state?.unlocked) return null;
  const time = safeTime(cityTime);
  const slot = Math.floor(time / ANTAGONIST_SLOT_SECONDS) % ROUTES.length;
  const cycle = Math.floor(time / ANTAGONIST_CYCLE_SECONDS);
  const route = ROUTES[slot];
  const profile = BRANCH_PROFILES[state.branch][state.aftermathChoice];
  return {
    ...route,
    activity: profile.activities[slot] || route.baseActivity,
    line: profile.line,
    slot,
    cycle,
    key: String(cycle) + ':' + String(slot),
    stage: getAntagonistStage(state),
    secondsUntilNext: Math.max(1, Math.ceil((slot + 1) * ANTAGONIST_SLOT_SECONDS - (time % ANTAGONIST_CYCLE_SECONDS)))
  };
}

export function getAntagonistPresentation(current, cityTime = 0) {
  const state = normalizeAntagonistState(current);
  const plan = getAntagonistPlan(state, cityTime);
  if (!state?.unlocked || !plan) return null;
  const alreadyEncountered = state.seenEncounters.includes(plan.key);
  const choices = alreadyEncountered ? [] : [
    { id: 'shadow', title: 'Follow the signal trail', hint: 'Gain a little intelligence without making a scene.' },
    { id: 'confront', title: 'Confront the operator', hint: 'Force a data drop, but draw serious attention.' },
    { id: 'decoy', title: 'Plant a false route', hint: 'Lower heat and send the operator chasing a dead end.' }
  ];
  return {
    kicker: 'UNREGISTERED OPERATOR / ' + plan.place.toUpperCase(),
    title: 'THE SWITCHBOARD',
    description: alreadyEncountered
      ? 'This route is cold. The operator has already clocked this meeting. Follow the next city cycle to catch a new move.'
      : plan.line,
    activity: plan.activity,
    stage: plan.stage,
    heat: state.heat,
    intel: state.intel,
    choices,
    alreadyEncountered,
    plan
  };
}

export function recordAntagonistEncounter(current, actionId, cityTime = 0) {
  const state = normalizeAntagonistState(current);
  if (!state?.unlocked) return { ok: false, reason: 'locked', state: state || createInitialAntagonistState() };
  const plan = getAntagonistPlan(state, cityTime);
  if (!plan) return { ok: false, reason: 'no-plan', state };
  if (!Object.hasOwn(ACTIONS, actionId)) return { ok: false, reason: 'invalid-action', state };
  if (state.seenEncounters.includes(plan.key)) return { ok: false, reason: 'already-encountered', state };
  const action = ACTIONS[actionId];
  const memory = { tag: action.tag, label: action.label, at: safeTime(cityTime) };
  const next = normalizeAntagonistState({
    ...state,
    intel: state.intel + action.intel,
    heat: state.heat + action.heat,
    decoys: state.decoys + action.decoys,
    encounters: state.encounters + 1,
    seenEncounters: [...state.seenEncounters, plan.key],
    lastMemory: action.tag,
    memories: [...state.memories, memory]
  });
  return {
    ok: true, state: next, action: actionId,
    message: action.message,
    memoryLabel: action.label,
    intelDelta: action.intel,
    heatDelta: action.heat,
    stage: getAntagonistStage(next)
  };
}

export function getAntagonistSummary(current) {
  const state = normalizeAntagonistState(current);
  if (!state?.unlocked) return 'NO KNOWN OPERATOR';
  return 'OPERATOR THREAD · ' + getAntagonistStage(state).toUpperCase() + ' · HEAT ' + state.heat + '/100 · INTEL ' + state.intel + '/3';
}

export function loadAntagonistState(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(ANTAGONIST_KEY);
    return raw ? normalizeAntagonistState(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function persistAntagonistState(storage, value) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  const normalized = normalizeAntagonistState(value);
  if (!normalized) return false;
  try { storage.setItem(ANTAGONIST_KEY, JSON.stringify(normalized)); return true; }
  catch { return false; }
}