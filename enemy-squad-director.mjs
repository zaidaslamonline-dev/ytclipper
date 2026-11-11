import { ENEMY_TACTIC_PROFILES } from './enemy-tactics.mjs';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const terminalEvents = new Set(['hit', 'blocked', 'missed', 'interrupted']);

export function createEnemySquadState() {
  return { lastAttacker: null, activeAttacker: null, sequence: 0 };
}

function normalizeState(state) {
  return {
    lastAttacker: typeof state?.lastAttacker === 'string' ? state.lastAttacker : null,
    activeAttacker: typeof state?.activeAttacker === 'string' ? state.activeAttacker : null,
    sequence: Math.max(0, Math.floor(finite(state?.sequence)))
  };
}

export function chooseSquadAttackPermit(currentState, actors = []) {
  const state = normalizeState(currentState);
  const living = actors.filter(actor => actor && typeof actor.id === 'string' && actor.id.length > 0 &&
    actor.alive !== false && actor.visible !== false && finite(actor.hp, 1) > 0 &&
    finite(actor.stun) <= 0 && ENEMY_TACTIC_PROFILES[actor.role]);

  // Keep ownership of an attack while its warning is visibly active.
  const telegraphing = living.find(actor => actor.phase === 'telegraph');
  if (telegraphing) {
    state.activeAttacker = telegraphing.id;
    return {
      state,
      permitId: telegraphing.id,
      waitingIds: living.filter(actor => actor.id !== telegraphing.id).map(actor => actor.id)
    };
  }

  const eligible = living.filter(actor => actor.phase === 'approach' &&
    finite(actor.cooldown) <= 0 &&
    Math.max(0, finite(actor.distance, Infinity)) <= ENEMY_TACTIC_PROFILES[actor.role].approachRange);

  if (!eligible.length) {
    state.activeAttacker = null;
    return { state, permitId: null, waitingIds: living.map(actor => actor.id) };
  }

  eligible.sort((a, b) => {
    const aRepeated = a.id === state.lastAttacker ? 1 : 0;
    const bRepeated = b.id === state.lastAttacker ? 1 : 0;
    return aRepeated - bRepeated || finite(a.distance, Infinity) - finite(b.distance, Infinity) ||
      a.id.localeCompare(b.id);
  });

  const selected = eligible[0];
  state.activeAttacker = selected.id;
  return {
    state,
    permitId: selected.id,
    waitingIds: living.filter(actor => actor.id !== selected.id).map(actor => actor.id)
  };
}

export function recordEnemySquadEvents(currentState, actorId, events = []) {
  const state = normalizeState(currentState);
  if (typeof actorId !== 'string' || !actorId) return state;
  const emitted = Array.isArray(events) ? events : [];

  if (emitted.includes('telegraph-start')) {
    state.lastAttacker = actorId;
    state.activeAttacker = actorId;
    state.sequence += 1;
  }
  if (emitted.some(event => terminalEvents.has(event)) && state.activeAttacker === actorId) {
    state.activeAttacker = null;
  }
  return state;
}
