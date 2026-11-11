import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSave, getCrewDialogue, loadSave, persistSave, recordCrewAssist } from '../crew-system.mjs';
import { CREW_COMBOS, getCrewComboOptions, recordCrewCombo } from '../crew-combos.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); } };
}
function trustedSave(trust = 70) {
  const save = createInitialSave();
  for (const entry of Object.values(save.crew)) entry.trust = trust;
  return save;
}

test('duo combos unlock only when both crew members reach 70 trust', () => {
  const save = trustedSave(70);
  save.crew.ria.trust = 69;
  const options = getCrewComboOptions(save, 0);
  assert.equal(options.find(item => item.id === 'milo-ria').unlocked, false);
  assert.equal(options.find(item => item.id === 'milo-bo').ready, true);
  assert.equal(options.find(item => item.id === 'ria-bo').unlocked, false);
});

test('all three original pairings have distinct tactical roles', () => {
  assert.deepEqual(CREW_COMBOS.map(item => item.id), ['milo-ria', 'milo-bo', 'ria-bo']);
  assert.ok(CREW_COMBOS.find(item => item.id === 'milo-bo').knockback > CREW_COMBOS.find(item => item.id === 'milo-ria').knockback);
  assert.ok(CREW_COMBOS.find(item => item.id === 'ria-bo').heal > 0);
  assert.equal(new Set(CREW_COMBOS.map(item => item.damage)).size, 3);
});

test('successful combo writes a memory and cooldown to both crew members', () => {
  const save = trustedSave(), result = recordCrewCombo(save, 'milo-ria', 42);
  assert.equal(result.ok, true);
  for (const id of ['milo', 'ria']) {
    assert.equal(save.crew[id].lastAssistAt, 42);
    assert.equal(save.crew[id].lastMemory, 'assist');
    assert.equal(save.crew[id].interactions, 1);
    assert.match(save.crew[id].memories.at(-1).label, /teamed up with you/);
    assert.match(getCrewDialogue(id, save.crew[id]).greeting, /opening|noise/);
  }
  assert.equal(getCrewComboOptions(save, 65).find(item => item.id === 'milo-ria').ready, false);
  assert.equal(getCrewComboOptions(save, 66).find(item => item.id === 'milo-ria').ready, true);
});

test('combo respects a partner individual-assist cooldown and uses the longer remaining time', () => {
  const save = trustedSave();
  recordCrewAssist(save, 'bo', 50);
  const status = getCrewComboOptions(save, 70).find(item => item.id === 'milo-bo');
  assert.equal(status.ready, false);
  assert.equal(status.remaining, 4);
  assert.equal(recordCrewCombo(save, 'milo-bo', 70).reason, 'cooldown');
});

test('unknown, locked and malformed combos never mutate crew state', () => {
  const save = createInitialSave();
  assert.equal(recordCrewCombo(save, 'spider-verse', 0).reason, 'unknown-combo');
  assert.equal(recordCrewCombo(save, 'milo-ria', 0).reason, 'trust');
  assert.equal(recordCrewCombo({ crew: { milo: {} } }, 'milo-ria', 0).reason, 'crew-state');
  assert.equal(save.crew.milo.interactions, 0);
});

test('combo memories and cooldowns survive the existing checkpoint serializer', () => {
  const save = trustedSave(), storage = memoryStorage();
  assert.equal(recordCrewCombo(save, 'ria-bo', 123).ok, true);
  assert.equal(persistSave(storage, save), true);
  const loaded = loadSave(storage);
  assert.equal(loaded.crew.ria.lastAssistAt, 123);
  assert.equal(loaded.crew.bo.memories.at(-1).tag, 'assist');
});
