import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATOR_PURSUIT_KEY, OPERATOR_RELAYS, canUnlockOperatorPursuit,
  collectOperatorPursuitRelay, createInitialOperatorPursuitState,
  getOperatorPursuitObjective, getOperatorPursuitSummary,
  loadOperatorPursuitState, normalizeOperatorPursuitState,
  persistOperatorPursuitState, unlockOperatorPursuit
} from '../operator-pursuit.mjs';

function storage() {
  const values = new Map();
  return { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); }, values };
}
function operator(branch = 'broadcast', aftermathChoice = 'protect-witness', intel = 3, heat = 20) {
  return { unlocked: true, branch, aftermathChoice, intel, heat };
}
function start(branch, choice) {
  return unlockOperatorPursuit(createInitialOperatorPursuitState(), operator(branch, choice), 42);
}

test('pursuit stays locked until the operator is validly unlocked and exposed or hunted', () => {
  assert.equal(canUnlockOperatorPursuit({ unlocked: false, branch: 'broadcast', aftermathChoice: 'protect-witness', intel: 3, heat: 80 }), false);
  assert.equal(canUnlockOperatorPursuit(operator('broadcast', 'burn-key', 3, 80)), false);
  assert.equal(canUnlockOperatorPursuit(operator('broadcast', 'protect-witness', 2, 64)), false);
  assert.equal(canUnlockOperatorPursuit(operator('broadcast', 'protect-witness', 3, 20)), true);
  assert.equal(canUnlockOperatorPursuit(operator('contain', 'burn-key', 0, 65)), true);
});

test('pursuit unlock records the originating story branch and checkpoint time', () => {
  const state = start('contain', 'share-key');
  assert.equal(state.unlocked, true);
  assert.equal(state.branch, 'contain');
  assert.equal(state.aftermathChoice, 'share-key');
  assert.equal(state.startedAt, 42);
  assert.equal(state.collected.length, 0);
});

test('each of the four story outcomes creates a distinct relay route', () => {
  const routes = [
    start('broadcast', 'protect-witness').route.join(','),
    start('broadcast', 'publish-receipt').route.join(','),
    start('contain', 'share-key').route.join(','),
    start('contain', 'burn-key').route.join(',')
  ];
  assert.equal(new Set(routes).size, 4);
  assert.deepEqual(start('broadcast', 'protect-witness').route, ['subway-tap', 'river-receiver', 'roofline-switch']);
  assert.deepEqual(start('contain', 'burn-key').route, ['river-receiver', 'subway-tap', 'roofline-switch']);
});

test('the first objective is a real geolocated city relay', () => {
  const objective = getOperatorPursuitObjective(start('broadcast', 'protect-witness'));
  assert.equal(objective.id, 'subway-tap');
  assert.equal(objective.districtId, 'transit');
  assert.equal(typeof objective.x, 'number');
  assert.equal(typeof objective.z, 'number');
  assert.equal(OPERATOR_RELAYS.length, 3);
});

test('a later relay cannot be collected out of order', () => {
  const result = collectOperatorPursuitRelay(start('broadcast', 'protect-witness'), 'roofline-switch', 50);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'wrong-relay');
  assert.equal(result.state.collected.length, 0);
});

test('collecting the active relay advances the objective and writes a memory', () => {
  const result = collectOperatorPursuitRelay(start('broadcast', 'protect-witness'), 'subway-tap', 55);
  assert.equal(result.ok, true);
  assert.equal(result.progress, 1);
  assert.equal(result.completed, false);
  assert.equal(result.state.memories.length, 1);
  assert.equal(getOperatorPursuitObjective(result.state).id, 'river-receiver');
});

test('a recovered relay cannot be collected twice', () => {
  const first = collectOperatorPursuitRelay(start('broadcast', 'protect-witness'), 'subway-tap', 55);
  const second = collectOperatorPursuitRelay(first.state, 'subway-tap', 60);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already-collected');
  assert.equal(second.state.collected.length, 1);
});

test('three ordered relays decode the route and end the pursuit', () => {
  let state = start('broadcast', 'protect-witness');
  for (const [index, id] of state.route.entries()) state = collectOperatorPursuitRelay(state, id, 60 + index * 10).state;
  assert.equal(state.completed, true);
  assert.equal(state.collected.length, 3);
  assert.equal(getOperatorPursuitObjective(state), null);
  assert.equal(getOperatorPursuitSummary(state), 'OPERATOR ROUTE DECODED · 3/3 RELAYS');
});

test('a completed route cannot award more memories or progress', () => {
  let state = start('contain', 'burn-key');
  for (const id of state.route) state = collectOperatorPursuitRelay(state, id, 100).state;
  const result = collectOperatorPursuitRelay(state, 'roofline-switch', 120);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'already-complete');
  assert.equal(result.state.memories.length, 3);
});

test('route progress and memories survive checkpoint persistence', () => {
  const store = storage();
  let state = start('contain', 'share-key');
  state = collectOperatorPursuitRelay(state, state.route[0], 72).state;
  assert.equal(persistOperatorPursuitState(store, state), true);
  assert.deepEqual(loadOperatorPursuitState(store), state);
  assert.equal(store.values.has(OPERATOR_PURSUIT_KEY), true);
});

test('normalization rejects invalid branch-choice pairs and out-of-order collected ids', () => {
  assert.equal(normalizeOperatorPursuitState({ version: 1, unlocked: true, branch: 'broadcast', aftermathChoice: 'burn-key' }).unlocked, false);
  const state = normalizeOperatorPursuitState({
    version: 1, unlocked: true, branch: 'broadcast', aftermathChoice: 'protect-witness',
    collected: ['river-receiver', 'roofline-switch'], memories: []
  });
  assert.deepEqual(state.collected, []);
  assert.equal(state.completed, false);
});

test('normalization derives completion from all three ordered relay ids', () => {
  const state = normalizeOperatorPursuitState({
    version: 1, unlocked: true, branch: 'contain', aftermathChoice: 'burn-key',
    collected: ['river-receiver', 'subway-tap', 'roofline-switch'], completed: false
  });
  assert.equal(state.completed, true);
  assert.equal(state.collected.length, 3);
});

test('malformed and unavailable storage fail safely', () => {
  assert.equal(loadOperatorPursuitState({ getItem: () => '{bad json' }), null);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadOperatorPursuitState(blocked), null);
  assert.equal(persistOperatorPursuitState(blocked, createInitialOperatorPursuitState()), false);
});

test('unknown relay ids and locked collections are rejected without mutation', () => {
  assert.equal(collectOperatorPursuitRelay(createInitialOperatorPursuitState(), 'subway-tap').reason, 'locked');
  assert.equal(collectOperatorPursuitRelay(start('broadcast', 'protect-witness'), 'alien-relay').reason, 'unknown-relay');
});

test('summary shows the next relay and clamps invalid checkpoint times', () => {
  assert.match(getOperatorPursuitSummary(start('broadcast', 'publish-receipt')), /NEXT: ROOFLINE SWITCH/);
  const state = normalizeOperatorPursuitState({
    version: 1, unlocked: true, branch: 'broadcast', aftermathChoice: 'publish-receipt',
    startedAt: 'NaN', collected: [], memories: [{ label: 'Relay recovered', at: Infinity }]
  });
  assert.equal(state.startedAt, 0);
  assert.equal(state.memories[0].at, 0);
});
