import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSave, loadSave, persistSave } from '../crew-system.mjs';
import { CREW_LIFE_CYCLE_SECONDS, CREW_LIFE_PLANS, getCrewLifeState } from '../crew-life.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test('each crew member has three distinct named activities', () => {
  for (const id of ['milo', 'ria', 'bo']) {
    assert.equal(CREW_LIFE_PLANS[id].length, 3);
    assert.equal(new Set(CREW_LIFE_PLANS[id].map(item => item.label)).size, 3);
  }
});

test('Milo follows diner, transit and newsstand duties in order', () => {
  assert.equal(getCrewLifeState('milo', 0).place, 'Corner Diner');
  assert.equal(getCrewLifeState('milo', 0).activity, 'MAPPING PATROLS');
  assert.equal(getCrewLifeState('milo', 23).place, 'Transit Plaza');
  assert.equal(getCrewLifeState('milo', 23).activity, 'CHECKING SUBWAY TIMES');
  assert.equal(getCrewLifeState('milo', 45).place, 'Newsstand');
  assert.equal(getCrewLifeState('milo', 45).activity, 'READING THE HEADLINES');
});

test('Ria and Bo have independent neighbourhood and training schedules', () => {
  assert.equal(getCrewLifeState('ria', 0).activity, 'TALKING WITH COMMUTERS');
  assert.equal(getCrewLifeState('ria', 23).activity, 'CHECKING ON SHOP OWNERS');
  assert.equal(getCrewLifeState('bo', 0).activity, 'TRAINING BY THE WATER');
  assert.equal(getCrewLifeState('bo', 23).activity, 'RUNNING COURT DRILLS');
  assert.equal(getCrewLifeState('bo', 45).activity, 'CATCHING UP WITH LOCALS');
});

test('the routine loops deterministically across a 66-second city-life cycle', () => {
  assert.equal(CREW_LIFE_CYCLE_SECONDS, 66);
  assert.equal(getCrewLifeState('milo', 66).place, getCrewLifeState('milo', 0).place);
  assert.equal(getCrewLifeState('milo', 66).activity, getCrewLifeState('milo', 0).activity);
  assert.equal(getCrewLifeState('milo', 66).cycle, 1);
  assert.equal(getCrewLifeState('ria', 132).cycle, 2);
});

test('schedule reports the next stop and next activity', () => {
  const state = getCrewLifeState('milo', 4);
  assert.equal(state.nextPlace, 'Transit Plaza');
  assert.equal(state.nextActivity, 'CHECKING SUBWAY TIMES');
  assert.equal(state.secondsUntilNext, 18);
});

test('schedule exposes commute and at-stop phases', () => {
  assert.equal(getCrewLifeState('bo', 14.9).schedulePhase, 'commute');
  assert.equal(getCrewLifeState('bo', 15).schedulePhase, 'at-stop');
});

test('each crew member has a distinct walking pace and idle pose', () => {
  const speeds = ['milo', 'ria', 'bo'].map(id => getCrewLifeState(id, 0).walkSpeed);
  assert.equal(new Set(speeds).size, 3);
  assert.equal(getCrewLifeState('milo', 0).idlePose, 'plan');
  assert.equal(getCrewLifeState('ria', 0).idlePose, 'talk');
  assert.equal(getCrewLifeState('bo', 0).idlePose, 'train');
});

test('unknown crew and malformed elapsed times are safe', () => {
  assert.equal(getCrewLifeState('unknown', 0), null);
  assert.equal(getCrewLifeState('milo', -500).place, 'Corner Diner');
  assert.equal(getCrewLifeState('milo', Number.NaN).place, 'Corner Diner');
});

test('the NPC schedule is reconstructed from the existing checkpoint city clock', () => {
  const storage = memoryStorage();
  const save = createInitialSave('Runner');
  save.cityTime = 45;
  assert.equal(persistSave(storage, save), true);
  const restored = loadSave(storage);
  assert.equal(getCrewLifeState('milo', restored.cityTime).activity, 'READING THE HEADLINES');
  assert.equal(getCrewLifeState('milo', restored.cityTime).place, 'Newsstand');
});
