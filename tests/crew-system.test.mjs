import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_KEY, createInitialSave, getCrewDialogue, getRelationshipLabel,
  getRoutineTarget, loadSave, persistSave, recordCrewChoice
} from '../crew-system.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values
  };
}

test('new timeline has bounded player state and all three crew bonds', () => {
  const save = createInitialSave('  Zaid  ');
  assert.equal(save.playerName, 'Zaid');
  assert.deepEqual(Object.keys(save.crew), ['milo', 'ria', 'bo']);
  assert.equal(save.crew.milo.trust, 50);
  assert.deepEqual(save.crew.ria.memories, []);
});

test('checkpoint round-trips player position, health and crew memories', () => {
  const storage = memoryStorage(), save = createInitialSave('Rookie');
  save.player.x = 4.5; save.player.z = -12; save.player.health = 63; save.cityTime = 91;
  recordCrewChoice(save, 'ria', 'share-secret');
  assert.equal(persistSave(storage, save), true);
  assert.equal(storage.values.has(SAVE_KEY), true);
  const loaded = loadSave(storage);
  assert.equal(loaded.player.x, 4.5); assert.equal(loaded.player.z, -12);
  assert.equal(loaded.player.health, 63); assert.equal(loaded.crew.ria.lastMemory, 'secret');
  assert.equal(loaded.crew.ria.interactions, 1);
});

test('crew choice changes trust and the next conversation remembers it', () => {
  const save = createInitialSave(), result = recordCrewChoice(save, 'milo', 'ask-plan');
  assert.equal(result.ok, true); assert.equal(result.trust, 58);
  const dialogue = getCrewDialogue('milo', save.crew.milo);
  assert.match(dialogue.greeting, /refining it/); assert.match(dialogue.memoryLine, /plan ahead/);
  assert.equal(dialogue.relationship, 'FRIENDS');
});

test('relationship tiers and trust are clamped at both ends', () => {
  assert.equal(getRelationshipLabel(10), 'DISTANT');
  assert.equal(getRelationshipLabel(35), 'WARMING UP');
  assert.equal(getRelationshipLabel(50), 'FRIENDS');
  assert.equal(getRelationshipLabel(70), 'TRUSTED');
  assert.equal(getRelationshipLabel(95), 'INNER CIRCLE');
  const save = createInitialSave(); save.crew.bo.trust = 99;
  assert.equal(recordCrewChoice(save, 'bo', 'check-in').trust, 100);
  save.crew.bo.trust = 1;
  assert.equal(recordCrewChoice(save, 'bo', 'brush-off').trust, 0);
});

test('NPC routines advance deterministically between named city stops', () => {
  assert.equal(getRoutineTarget('milo', 0).place, 'Corner Diner');
  assert.equal(getRoutineTarget('milo', 23).place, 'Transit Plaza');
  assert.equal(getRoutineTarget('milo', 45).place, 'Newsstand');
  assert.equal(getRoutineTarget('unknown', 0), null);
});

test('corrupt or unavailable storage never crashes the game', () => {
  const corrupt = { getItem: () => '{not-json' };
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadSave(corrupt), null); assert.equal(loadSave(blocked), null);
  assert.equal(persistSave(blocked, createInitialSave()), false);
  assert.equal(persistSave(memoryStorage(), { version: 99 }), false);
});
