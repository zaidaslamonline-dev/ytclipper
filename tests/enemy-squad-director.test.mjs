import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceEnemyTactics, createEnemyTacticState } from '../enemy-tactics.mjs';
import { chooseSquadAttackPermit, createEnemySquadState, recordEnemySquadEvents } from '../enemy-squad-director.mjs';

const actors = () => [
  { id:'breacher', role:'breacher', phase:'approach', cooldown:0, distance:2.2, hp:100, visible:true },
  { id:'cutter', role:'flanker', phase:'approach', cooldown:0, distance:2.3, hp:100, visible:true }
];

test('the director grants exactly one attack permit when both enemies are in range', () => {
  const result = chooseSquadAttackPermit(createEnemySquadState(), actors());
  assert.equal(result.permitId, 'breacher');
  assert.deepEqual(result.waitingIds, ['cutter']);
});

test('the non-selected enemy is held in approach and cannot start a wind-up', () => {
  const result = chooseSquadAttackPermit(createEnemySquadState(), actors());
  const held = advanceEnemyTactics(createEnemyTacticState('flanker'), { distance:2.1, allowAttack:result.permitId==='cutter' }, .04);
  assert.equal(held.state.phase, 'approach');
  assert.deepEqual(held.events, []);
});

test('the selected enemy can telegraph while its partner remains held', () => {
  const result = chooseSquadAttackPermit(createEnemySquadState(), actors());
  const strike = advanceEnemyTactics(createEnemyTacticState('breacher'), { distance:2.1, allowAttack:result.permitId==='breacher' }, .04);
  const wait = advanceEnemyTactics(createEnemyTacticState('flanker'), { distance:2.1, allowAttack:result.permitId==='flanker' }, .04);
  assert.equal(strike.state.phase, 'telegraph');
  assert.deepEqual(strike.events, ['telegraph-start']);
  assert.equal(wait.state.phase, 'approach');
});

test('an existing telegraph keeps priority even if the other enemy is closer', () => {
  const input = actors();
  input[0].phase = 'telegraph'; input[0].distance = 2.4;
  input[1].distance = 1.1;
  const result = chooseSquadAttackPermit(createEnemySquadState(), input);
  assert.equal(result.permitId, 'breacher');
});

test('the next attack alternates to the partner after a wind-up starts', () => {
  const state = recordEnemySquadEvents(createEnemySquadState(), 'breacher', ['telegraph-start']);
  const inFlight = actors(); inFlight[0].phase = 'telegraph';
  const result = chooseSquadAttackPermit(state, inFlight);
  assert.equal(result.permitId, 'breacher');
  const released = recordEnemySquadEvents(state, 'breacher', ['blocked']);
  const next = chooseSquadAttackPermit(released, actors());
  assert.equal(next.permitId, 'cutter');
});

test('interrupting a telegraph releases the lane for the partner', () => {
  const state = recordEnemySquadEvents(createEnemySquadState(), 'cutter', ['telegraph-start']);
  const interrupted = recordEnemySquadEvents(state, 'cutter', ['interrupted']);
  const result = chooseSquadAttackPermit(interrupted, actors());
  assert.equal(result.permitId, 'breacher');
  assert.equal(interrupted.sequence, 1);
});

test('dead, hidden and unknown-role enemies cannot receive a permit', () => {
  const result = chooseSquadAttackPermit(createEnemySquadState(), [
    { id:'dead', role:'breacher', phase:'approach', distance:1, hp:0 },
    { id:'hidden', role:'flanker', phase:'approach', distance:1, hp:100, visible:false },
    { id:'mystery', role:'unknown', phase:'approach', distance:1, hp:100 }
  ]);
  assert.equal(result.permitId, null);
});

test('cooling-down or out-of-range actors leave the squad lane unassigned', () => {
  const list = actors().map(actor => ({ ...actor, cooldown:1, distance:9 }));
  const result = chooseSquadAttackPermit(createEnemySquadState(), list);
  assert.equal(result.permitId, null);
  assert.equal(result.state.activeAttacker, null);
});

test('a missing or malformed director state safely resets', () => {
  const result = chooseSquadAttackPermit({ lastAttacker:42, activeAttacker:[], sequence:-2 }, actors());
  assert.equal(result.state.lastAttacker, null);
  assert.equal(result.state.sequence, 0);
  assert.equal(result.permitId, 'breacher');
});

test('an event from a non-active actor cannot clear the current attacker', () => {
  const state = recordEnemySquadEvents(createEnemySquadState(), 'breacher', ['telegraph-start']);
  const unchanged = recordEnemySquadEvents(state, 'cutter', ['missed']);
  assert.equal(unchanged.activeAttacker, 'breacher');
});

test('a stunned attacker yields the lane to an available partner', () => {
  const list = actors(); list[0].stun = .4;
  const result = chooseSquadAttackPermit(createEnemySquadState(), list);
  assert.equal(result.permitId, 'cutter');
});
