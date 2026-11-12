import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AFTERMATH_CLUES, AFTERMATH_KEY, collectAftermathClue, createInitialAftermathState,
  getAftermathChoices, getAftermathClue, getAftermathPresentation, getAftermathSummary,
  loadAftermathState, normalizeAftermathState, persistAftermathState, resolveAftermathChoice,
  unlockAftermath
} from '../signal-aftermath.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values
  };
}

test('each original ending unlocks only its own physical follow-up clue', () => {
  const broadcast = unlockAftermath(createInitialAftermathState(), 'broadcast');
  const contain = unlockAftermath(createInitialAftermathState(), 'contain');
  assert.equal(getAftermathClue(broadcast).id, 'witness-cache');
  assert.equal(getAftermathClue(contain).id, 'shadow-relay');
  assert.equal(AFTERMATH_CLUES.length, 2);
});

test('invalid endings cannot unlock a branch or a clue', () => {
  const state = unlockAftermath(createInitialAftermathState(), 'marvel');
  assert.equal(state.branch, null);
  assert.equal(getAftermathClue(state), null);
});

test('a branch cannot be changed after it is unlocked', () => {
  const state = unlockAftermath(createInitialAftermathState(), 'broadcast');
  assert.equal(unlockAftermath(state, 'contain').branch, 'broadcast');
});

test('the wrong branch clue is rejected without changing progress', () => {
  const state = unlockAftermath(createInitialAftermathState(), 'broadcast');
  const result = collectAftermathClue(state, 'shadow-relay');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'wrong-branch-clue');
  assert.equal(result.state.clueCollected, false);
});

test('the correct clue is collected exactly once', () => {
  const state = unlockAftermath(createInitialAftermathState(), 'contain');
  const first = collectAftermathClue(state, 'shadow-relay');
  assert.equal(first.ok, true);
  assert.equal(first.state.clueCollected, true);
  const second = collectAftermathClue(first.state, 'shadow-relay');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already-collected');
});

test('follow-up decisions remain locked until the branch clue is collected', () => {
  const state = unlockAftermath(createInitialAftermathState(), 'broadcast');
  assert.deepEqual(getAftermathChoices(state), []);
  assert.equal(resolveAftermathChoice(state, 'protect-witness').reason, 'evidence-incomplete');
});

test('broadcast aftermath offers two distinct choices and relationship outcomes', () => {
  let state = unlockAftermath(createInitialAftermathState(), 'broadcast');
  state = collectAftermathClue(state, 'witness-cache').state;
  const presentation = getAftermathPresentation(state);
  assert.match(presentation.title, /protected/);
  assert.equal(presentation.choices.length, 2);
  const result = resolveAftermathChoice(state, 'protect-witness');
  assert.equal(result.ok, true);
  assert.equal(result.bondId, 'ria');
  assert.equal(result.delta, 6);
  assert.equal(result.ending, 'broadcast');
});

test('contain aftermath has its own decisions and can strengthen Bo instead of Milo', () => {
  let state = unlockAftermath(createInitialAftermathState(), 'contain');
  state = collectAftermathClue(state, 'shadow-relay').state;
  const result = resolveAftermathChoice(state, 'burn-key');
  assert.equal(result.ok, true);
  assert.equal(result.bondId, 'bo');
  assert.equal(result.delta, 6);
  assert.match(result.message, /KEY BURNED/);
});

test('choices from the opposite branch cannot be applied', () => {
  let state = unlockAftermath(createInitialAftermathState(), 'contain');
  state = collectAftermathClue(state, 'shadow-relay').state;
  assert.equal(resolveAftermathChoice(state, 'protect-witness').reason, 'invalid-choice');
});

test('resolved aftermath cannot be farmed or replayed', () => {
  let state = unlockAftermath(createInitialAftermathState(), 'broadcast');
  state = collectAftermathClue(state, 'witness-cache').state;
  state = resolveAftermathChoice(state, 'publish-receipt').state;
  assert.equal(getAftermathClue(state), null);
  assert.equal(getAftermathChoices(state).length, 0);
  assert.equal(resolveAftermathChoice(state, 'protect-witness').reason, 'already-resolved');
  assert.match(getAftermathSummary(state), /CHAPTER 01 COMPLETE/);
});

test('aftermath state round-trips through persistent storage', () => {
  const storage = memoryStorage();
  let state = unlockAftermath(createInitialAftermathState(), 'contain');
  state = collectAftermathClue(state, 'shadow-relay').state;
  state = resolveAftermathChoice(state, 'share-key').state;
  assert.equal(persistAftermathState(storage, state), true);
  assert.deepEqual(loadAftermathState(storage), state);
  assert.equal(storage.values.has(AFTERMATH_KEY), true);
});

test('malformed or blocked storage degrades safely', () => {
  assert.equal(loadAftermathState({ getItem: () => '{broken' }), null);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadAftermathState(blocked), null);
  assert.equal(persistAftermathState(blocked, createInitialAftermathState()), false);
});

test('normalization drops impossible choice states and unknown branch values', () => {
  assert.deepEqual(normalizeAftermathState({ version: 1, branch: 'broadcast', clueCollected: false, choice: 'protect-witness' }), {
    version: 1, branch: 'broadcast', clueCollected: false, choice: null
  });
  assert.deepEqual(normalizeAftermathState({ version: 1, branch: 'alien', clueCollected: true, choice: 'burn-key' }), {
    version: 1, branch: null, clueCollected: false, choice: null
  });
});

test('a pending follow-up decision survives reload with both choices available', () => {
  const storage = memoryStorage();
  let state = unlockAftermath(createInitialAftermathState(), 'broadcast');
  state = collectAftermathClue(state, 'witness-cache').state;
  assert.equal(persistAftermathState(storage, state), true);
  const restored = loadAftermathState(storage);
  assert.equal(restored.clueCollected, true);
  assert.equal(restored.choice, null);
  assert.equal(getAftermathPresentation(restored).choices.length, 2);
  assert.match(getAftermathSummary(restored), /DECISION READY/);
});
