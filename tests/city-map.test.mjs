import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_DISTRICTS, CITY_PROGRESS_KEY, SIGNAL_CLUES, collectSignalClue, createInitialCityProgress, getSignalMissionSummary, loadCityProgress, normalizeCityProgress, persistCityProgress, resolveSignalCase } from '../city-map.mjs';
import { CREW_PROFILES, createInitialSave, getCrewDialogue } from '../crew-system.mjs';
function memoryStorage() {
  const values = new Map();
  return { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); }, values };
}
test('city map exposes four playable destinations and three evidence locations', () => {
  assert.equal(CITY_DISTRICTS.length, 4); assert.equal(SIGNAL_CLUES.length, 3);
  for (const district of CITY_DISTRICTS) { assert.ok(district.x >= -7 && district.x <= 7); assert.ok(district.z >= -70 && district.z <= 70); }
});
test('fast-travel arrival leaves each signal beacon as the nearest interaction', () => {
  for (const clue of SIGNAL_CLUES) {
    const district = CITY_DISTRICTS.find(item => item.id === clue.districtId);
    const clueDistance = Math.hypot(district.x - clue.x, district.z - clue.z);
    const nearestCrew = Object.values(CREW_PROFILES).flatMap(profile => profile.routine)
      .reduce((best, stop) => Math.min(best, Math.hypot(district.x - stop.x, district.z - stop.z)), Infinity);
    assert.ok(clueDistance < 3.35);
    assert.ok(clueDistance < nearestCrew, clue.id + ' should not be blocked by an NPC interaction');
  }
});

test('evidence collection is unique and completes only after all three traces', () => {
  let progress = createInitialCityProgress();
  for (const clue of SIGNAL_CLUES.slice(0, 2)) { const result = collectSignalClue(progress, clue.id); assert.equal(result.ok, true); assert.equal(result.complete, false); progress = result.progress; }
  assert.equal(collectSignalClue(progress, SIGNAL_CLUES[0].id).reason, 'already-collected');
  const final = collectSignalClue(progress, SIGNAL_CLUES[2].id); assert.equal(final.complete, true); assert.equal(final.progress.clues.length, 3);
});
test('unknown clue IDs cannot corrupt mission progress', () => {
  const result = collectSignalClue(createInitialCityProgress(), 'unlicensed-character-art');
  assert.equal(result.ok, false); assert.equal(result.reason, 'unknown-clue'); assert.deepEqual(result.progress.clues, []);
});
test('ending is locked until evidence is complete and only accepts two branches', () => {
  const empty = resolveSignalCase(createInitialCityProgress(), 'broadcast'); assert.equal(empty.reason, 'evidence-incomplete');
  let progress = createInitialCityProgress(); for (const clue of SIGNAL_CLUES) progress = collectSignalClue(progress, clue.id).progress;
  assert.equal(resolveSignalCase(progress, 'hijack').reason, 'invalid-choice');
  const result = resolveSignalCase(progress, 'broadcast'); assert.equal(result.ok, true); assert.equal(result.bondId, 'ria'); assert.equal(result.trustDelta, 8); assert.equal(result.progress.ending, 'broadcast');
  assert.equal(resolveSignalCase(result.progress, 'contain').reason, 'already-resolved');
});
test('quiet ending branches toward Milo and persists a distinct outcome', () => {
  let progress = createInitialCityProgress(); for (const clue of SIGNAL_CLUES) progress = collectSignalClue(progress, clue.id).progress;
  const result = resolveSignalCase(progress, 'contain'); assert.equal(result.bondId, 'milo'); assert.equal(result.memoryTag, 'signal-contained');
  assert.match(getSignalMissionSummary(result.progress), /CREW KEPT IT QUIET/);
});
test('story ending is remembered in the selected crew member dialogue', () => {
  const save = createInitialSave(); save.crew.ria.lastMemory = 'signal-broadcast'; save.crew.milo.lastMemory = 'signal-contained';
  assert.match(getCrewDialogue('ria', save.crew.ria).greeting, /neighbourhood hear the truth/);
  assert.match(getCrewDialogue('milo', save.crew.milo).greeting, /safer way to act on it/);
});
test('city progress round-trips and sanitizes unknown clue IDs', () => {
  const storage = memoryStorage(); let progress = createInitialCityProgress(); progress = collectSignalClue(progress, SIGNAL_CLUES[1].id).progress;
  assert.equal(persistCityProgress(storage, progress), true); assert.deepEqual(loadCityProgress(storage), progress);
  assert.deepEqual(normalizeCityProgress({ version: 1, clues: ['subway-relay', 'bogus', 'subway-relay'], ending: 'broadcast' }), { version: 1, clues: ['subway-relay'], ending: null });
  assert.equal(storage.values.has(CITY_PROGRESS_KEY), true);
});
test('corrupt or blocked storage degrades safely', () => {
  assert.equal(loadCityProgress({ getItem: () => '{broken' }), null);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadCityProgress(blocked), null); assert.equal(persistCityProgress(blocked, createInitialCityProgress()), false);
});
