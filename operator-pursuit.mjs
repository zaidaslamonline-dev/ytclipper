export const OPERATOR_PURSUIT_KEY = 'stickcity-operator-pursuit-v1';

export const OPERATOR_RELAYS = Object.freeze([
  Object.freeze({ id: 'subway-tap', label: 'Subway Tap', districtId: 'transit', description: 'A maintenance junction is mirroring the operator’s private channel.', x: 4.8, z: -30.6, color: 0x55d5e8 }),
  Object.freeze({ id: 'river-receiver', label: 'River Receiver', districtId: 'riverside', description: 'A receiver beneath the river walk is carrying the operator’s route pings.', x: 7.4, z: -46.3, color: 0x69e2b2 }),
  Object.freeze({ id: 'roofline-switch', label: 'Roofline Switch', districtId: 'signal', description: 'The old mast is relaying the final encrypted hand-off.', x: -4.4, z: -61.7, color: 0xd8a2ff })
]);

const RELAY_IDS = new Set(OPERATOR_RELAYS.map(relay => relay.id));
const ROUTES = Object.freeze({
  broadcast: Object.freeze({
    'protect-witness': Object.freeze(['subway-tap', 'river-receiver', 'roofline-switch']),
    'publish-receipt': Object.freeze(['roofline-switch', 'subway-tap', 'river-receiver'])
  }),
  contain: Object.freeze({
    'share-key': Object.freeze(['subway-tap', 'roofline-switch', 'river-receiver']),
    'burn-key': Object.freeze(['river-receiver', 'subway-tap', 'roofline-switch'])
  })
});

const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const safeTime = value => clamp(value, 0, 1e9, 0);
const validChoice = (branch, choice) => !!ROUTES[branch] && Object.hasOwn(ROUTES[branch], choice);
const routeFor = (branch, choice) => validChoice(branch, choice) ? ROUTES[branch][choice] : [];

export function createInitialOperatorPursuitState() {
  return { version: 1, unlocked: false, branch: null, aftermathChoice: null, route: [], collected: [], completed: false, startedAt: null, completedAt: null, lastRelay: null, memories: [] };
}

export function normalizeOperatorPursuitState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return null;
  const unlocked = value.unlocked === true && validChoice(value.branch, value.aftermathChoice);
  const branch = unlocked ? value.branch : null;
  const aftermathChoice = unlocked ? value.aftermathChoice : null;
  const route = unlocked ? [...routeFor(branch, aftermathChoice)] : [];
  const collectedSet = new Set(Array.isArray(value.collected) ? value.collected.filter(id => RELAY_IDS.has(id)) : []);
  let progress = 0;
  while (progress < route.length && collectedSet.has(route[progress])) progress += 1;
  const collected = route.slice(0, progress);
  const completed = unlocked && progress === route.length;
  const memories = Array.isArray(value.memories)
    ? value.memories.filter(item => item && typeof item.label === 'string').slice(-6).map(item => ({
        tag: typeof item.tag === 'string' ? item.tag.slice(0, 48) : 'relay-recovered',
        label: item.label.slice(0, 180),
        at: safeTime(item.at)
      }))
    : [];
  return {
    version: 1, unlocked, branch, aftermathChoice, route, collected, completed,
    startedAt: unlocked ? safeTime(value.startedAt) : null,
    completedAt: completed ? safeTime(value.completedAt) : null,
    lastRelay: typeof value.lastRelay === 'string' && RELAY_IDS.has(value.lastRelay) ? value.lastRelay : null,
    memories
  };
}

export function canUnlockOperatorPursuit(antagonistState) {
  if (!antagonistState || antagonistState.unlocked !== true) return false;
  if (!validChoice(antagonistState.branch, antagonistState.aftermathChoice)) return false;
  return clamp(antagonistState.intel, 0, 3, 0) >= 3 || clamp(antagonistState.heat, 0, 100, 0) >= 65;
}

export function unlockOperatorPursuit(current, antagonistState, cityTime = 0) {
  const state = normalizeOperatorPursuitState(current) || createInitialOperatorPursuitState();
  if (state.unlocked || !canUnlockOperatorPursuit(antagonistState)) return state;
  return normalizeOperatorPursuitState({
    ...createInitialOperatorPursuitState(),
    unlocked: true,
    branch: antagonistState.branch,
    aftermathChoice: antagonistState.aftermathChoice,
    route: routeFor(antagonistState.branch, antagonistState.aftermathChoice),
    startedAt: safeTime(cityTime)
  });
}

export function getOperatorPursuitObjective(current) {
  const state = normalizeOperatorPursuitState(current);
  if (!state?.unlocked || state.completed) return null;
  const id = state.route[state.collected.length];
  const relay = OPERATOR_RELAYS.find(item => item.id === id);
  if (!relay) return null;
  return { ...relay, index: state.collected.length, progress: state.collected.length, total: state.route.length };
}

export function collectOperatorPursuitRelay(current, relayId, cityTime = 0) {
  const state = normalizeOperatorPursuitState(current) || createInitialOperatorPursuitState();
  if (!state.unlocked) return { ok: false, reason: 'locked', state };
  if (state.completed) return { ok: false, reason: 'already-complete', state };
  if (!RELAY_IDS.has(relayId)) return { ok: false, reason: 'unknown-relay', state };
  if (state.collected.includes(relayId)) return { ok: false, reason: 'already-collected', state };
  const objective = getOperatorPursuitObjective(state);
  if (!objective || objective.id !== relayId) return { ok: false, reason: 'wrong-relay', state };
  const relay = OPERATOR_RELAYS.find(item => item.id === relayId);
  const memory = { tag: 'operator-relay-' + relayId, label: 'You recovered the ' + relay.label + ' and copied its route fragment', at: safeTime(cityTime) };
  const next = normalizeOperatorPursuitState({
    ...state,
    collected: [...state.collected, relayId],
    lastRelay: relayId,
    completedAt: state.collected.length + 1 === state.route.length ? safeTime(cityTime) : null,
    memories: [...state.memories, memory]
  });
  return {
    ok: true, state: next, relay, progress: next.collected.length, total: next.route.length,
    completed: next.completed, memoryLabel: memory.label,
    message: next.completed
      ? 'ROUTE DECODED · All three relay fragments expose the Switchboard’s next hand-off.'
      : 'RELAY ' + next.collected.length + '/3 RECOVERED · ' + relay.label.toUpperCase() + ' copied. The next relay is marked on the city map.'
  };
}

export function getOperatorPursuitSummary(current) {
  const state = normalizeOperatorPursuitState(current);
  if (!state?.unlocked) return 'OPERATOR PURSUIT LOCKED · REACH INTEL 3 OR HEAT 65';
  if (state.completed) return 'OPERATOR ROUTE DECODED · 3/3 RELAYS';
  const objective = getOperatorPursuitObjective(state);
  return 'OPERATOR PURSUIT · ' + state.collected.length + '/3 · NEXT: ' + (objective?.label.toUpperCase() || 'UNKNOWN');
}

export function loadOperatorPursuitState(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try { const raw = storage.getItem(OPERATOR_PURSUIT_KEY); return raw ? normalizeOperatorPursuitState(JSON.parse(raw)) : null; }
  catch { return null; }
}

export function persistOperatorPursuitState(storage, value) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  const normalized = normalizeOperatorPursuitState(value);
  if (!normalized) return false;
  try { storage.setItem(OPERATOR_PURSUIT_KEY, JSON.stringify(normalized)); return true; }
  catch { return false; }
}
