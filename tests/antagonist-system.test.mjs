import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANTAGONIST_CYCLE_SECONDS, ANTAGONIST_KEY, activateAntagonist,
  createInitialAntagonistState, getAntagonistPlan, getAntagonistPresentation,
  getAntagonistStage, getAntagonistSummary, loadAntagonistState,
  normalizeAntagonistState, persistAntagonistState, recordAntagonistEncounter
} from '../antagonist-system.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values
  };
}

function unlocked(branch = 'broadcast', choice = 'protect-witness') {
  return activateAntagonist(createInitialAntagonistState(), branch, choice);
}

test('operator remains absent until a valid chapter-one branch and choice are complete', () => {
  assert.equal(getAntagonistPlan(createInitialAntagonistState(), 0), null);
  assert.equal(activateAntagonist(createInitialAntagonistState(), 'broadcast', 'burn-key').unlocked, false);
  assert.equal(activateAntagonist(createInitialAntagonistState(), 'contain', 'protect-witness').unlocked, false);
});

test('broadcast and containment outcomes initialize different operator heat and memory profiles', () => {
  assert.equal(unlocked('broadcast', 'publish-receipt').heat, 22);
  assert.equal(unlocked('contain', 'share-key').heat, 18);
  assert.equal(unlocked('contain', 'burn-key').heat, 8);
});

test('operator follows a deterministic four-stop city route', () => {
  const state = unlocked();
  const plans = [0, 48, 96, 144].map(time => getAntagonistPlan(state, time));
  assert.deepEqual(plans.map(plan => plan.districtId), ['midtown', 'transit', 'riverside', 'signal']);
  assert.equal(getAntagonistPlan(state, ANTAGONIST_CYCLE_SECONDS).key, '1:0');
});

test('branch-specific aftermath choices change the operator activity and dialogue', () => {
  const broadcast = getAntagonistPlan(unlocked('broadcast', 'protect-witness'), 0);
  const contain = getAntagonistPlan(unlocked('contain', 'burn-key'), 0);
  assert.match(broadcast.activity, /WITNESS/);
  assert.match(contain.activity, /ORIGINAL ROUTE/);
  assert.notEqual(broadcast.line, contain.line);
});

test('presentation offers three meaningful approaches before an encounter', () => {
  const view = getAntagonistPresentation(unlocked(), 0);
  assert.equal(view.title, 'THE SWITCHBOARD');
  assert.equal(view.choices.length, 3);
  assert.equal(view.heat, 12);
  assert.equal(view.intel, 0);
});

test('shadowing gains one intel and a persistent memory with modest heat', () => {
  const result = recordAntagonistEncounter(unlocked(), 'shadow', 2);
  assert.equal(result.ok, true);
  assert.equal(result.state.intel, 1);
  assert.equal(result.state.heat, 16);
  assert.equal(result.state.memories.length, 1);
  assert.equal(getAntagonistStage(result.state), 'traced');
});

test('confrontation gives more intel but sharply increases heat', () => {
  const result = recordAntagonistEncounter(unlocked(), 'confront', 2);
  assert.equal(result.state.intel, 2);
  assert.equal(result.state.heat, 28);
  assert.match(result.message, /DATA DROP/);
});

test('a decoy lowers heat without falsely granting intelligence', () => {
  const result = recordAntagonistEncounter(unlocked('broadcast', 'publish-receipt'), 'decoy', 2);
  assert.equal(result.state.heat, 10);
  assert.equal(result.state.intel, 0);
  assert.equal(result.state.decoys, 1);
});

test('the same scheduled sighting cannot be farmed twice', () => {
  const first = recordAntagonistEncounter(unlocked(), 'shadow', 2);
  const second = recordAntagonistEncounter(first.state, 'confront', 8);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already-encountered');
  assert.equal(second.state.encounters, 1);
  assert.equal(getAntagonistPresentation(first.state, 8).choices.length, 0);
});

test('a later city slot permits a new encounter and the third intel exposes the operator', () => {
  let state = unlocked();
  state = recordAntagonistEncounter(state, 'shadow', 1).state;
  state = recordAntagonistEncounter(state, 'confront', 50).state;
  state = recordAntagonistEncounter(state, 'shadow', 98).state;
  assert.equal(state.intel, 3);
  assert.equal(getAntagonistStage(state), 'exposed');
});

test('heat can escalate the operator into an active hunt', () => {
  let state = unlocked('broadcast', 'publish-receipt');
  state = recordAntagonistEncounter(state, 'confront', 1).state;
  state = recordAntagonistEncounter(state, 'confront', 50).state;
  state = recordAntagonistEncounter(state, 'confront', 98).state;
  assert.equal(state.heat, 70);
  assert.equal(getAntagonistStage(state), 'hunted');
});

test('operator state and encounter history survive checkpoint storage', () => {
  const storage = memoryStorage();
  let state = unlocked('contain', 'share-key');
  state = recordAntagonistEncounter(state, 'shadow', 21).state;
  assert.equal(persistAntagonistState(storage, state), true);
  assert.deepEqual(loadAntagonistState(storage), state);
  assert.equal(storage.values.has(ANTAGONIST_KEY), true);
});

test('normalization rejects invalid branch-choice pairs and clamps corrupted counters', () => {
  assert.equal(normalizeAntagonistState({ version: 1, unlocked: true, branch: 'broadcast', aftermathChoice: 'burn-key' }).unlocked, false);
  const state = normalizeAntagonistState({ version: 1, unlocked: true, branch: 'contain', aftermathChoice: 'burn-key', intel: 99, heat: -5, decoys: -1, encounters: 4.9, seenEncounters: ['0:0', 'bad'], memories: [{ label: 'A'.repeat(220), at: 12 }] });
  assert.equal(state.intel, 3);
  assert.equal(state.heat, 0);
  assert.equal(state.decoys, 0);
  assert.equal(state.encounters, 4);
  assert.deepEqual(state.seenEncounters, ['0:0']);
  assert.equal(state.memories[0].label.length, 180);
});

test('malformed and blocked storage fail safely', () => {
  assert.equal(loadAntagonistState({ getItem: () => '{broken' }), null);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadAntagonistState(blocked), null);
  assert.equal(persistAntagonistState(blocked, createInitialAntagonistState()), false);
});

test('summary exposes stage, heat and intel to the city HUD', () => {
  const state = recordAntagonistEncounter(unlocked(), 'shadow', 2).state;
  assert.equal(getAntagonistSummary(state), 'OPERATOR THREAD · TRACED · HEAT 16/100 · INTEL 1/3');
  assert.equal(getAntagonistSummary(createInitialAntagonistState()), 'NO KNOWN OPERATOR');
});