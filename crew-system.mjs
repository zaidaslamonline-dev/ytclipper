export const SAVE_KEY = 'stickcity-save-v1';

export const CREW_PROFILES = Object.freeze({
  milo: Object.freeze({
    name: 'Milo', role: 'The strategist', color: '#c89438', skin: '#b87959', hair: '#17202b',
    routine: [{ x: -3, z: 9, place: 'Corner Diner' }, { x: 2, z: 3, place: 'Transit Plaza' }, { x: -5, z: -8, place: 'Newsstand' }],
    firstGreeting: 'Milo is studying the block like it is a puzzle. He notices you before you say a word.',
    memoryReplies: {
      strategy: 'You came back to the plan. I kept refining it while I walked the neighbourhood.',
      lead: 'That lead you shared is still on my board. I found one more angle worth checking.',
      doubt: 'I remember you challenged my idea. Good. A plan that cannot survive questions is not a plan.'
    },
    choices: [
      { id: 'ask-plan', label: 'Ask him to map the next move', hint: 'Give the strategist room to think.', delta: 8, memory: 'strategy', memoryLabel: 'You asked Milo to plan ahead', reply: 'Milo opens his notebook. Three possible routes, one clear priority. He trusts you with the unfinished version.' },
      { id: 'share-lead', label: 'Share a lead from the block', hint: 'Trade information instead of orders.', delta: 6, memory: 'lead', memoryLabel: 'You shared a neighbourhood lead', reply: 'Milo pins the lead to his map and promises to check it before the next nightfall.' },
      { id: 'challenge', label: 'Challenge his assumptions', hint: 'A little friction can sharpen a good idea.', delta: -2, memory: 'doubt', memoryLabel: 'You challenged Milo’s plan', reply: 'Milo frowns, then nods. He would rather be corrected now than be wrong when it matters.' }
    ]
  }),
  ria: Object.freeze({
    name: 'Ria', role: 'The neighbourhood connector', color: '#278d91', skin: '#9d684f', hair: '#20202d',
    routine: [{ x: 4, z: -8, place: 'Subway Entrance' }, { x: -5, z: 2, place: 'Newsstand' }, { x: 5, z: 13, place: 'Corner Diner' }],
    firstGreeting: 'Ria is halfway through a conversation with a shop owner. She makes room for you without losing the thread.',
    memoryReplies: {
      people: 'You wanted to know who makes this neighbourhood tick. I have a few names for you.',
      secret: 'Your secret stayed with me. I have not repeated it, and I will not.',
      ignored: 'Last time you brushed past my warning. I am giving you another chance to hear it.'
    },
    choices: [
      { id: 'ask-people', label: 'Ask who really runs this block', hint: 'Learn the neighbourhood through its people.', delta: 8, memory: 'people', memoryLabel: 'You asked Ria about the neighbourhood', reply: 'Ria names the people who keep the street alive: the night-shift cook, the courier, the old woman who sees everything.' },
      { id: 'share-secret', label: 'Share something you have not told the crew', hint: 'Trust is a two-way street.', delta: 9, memory: 'secret', memoryLabel: 'You trusted Ria with a secret', reply: 'Ria listens without interrupting. She does not promise to fix it. She promises you will not carry it alone.' },
      { id: 'ignore-warning', label: 'Brush off her warning', hint: 'You can disagree, but she will remember.', delta: -4, memory: 'ignored', memoryLabel: 'You ignored Ria’s warning', reply: 'Ria lets the silence sit. She will keep watching the street, even if you are not ready to listen.' }
    ]
  }),
  bo: Object.freeze({
    name: 'Bo', role: 'The heart of the crew', color: '#bd6545', skin: '#d19a74', hair: '#282a30',
    routine: [{ x: -5, z: -18, place: 'Riverside Steps' }, { x: 5, z: -22, place: 'Basketball Court' }, { x: 4, z: 3, place: 'Corner Diner' }],
    firstGreeting: 'Bo is bouncing a ball against the wall. He grins like the whole city is one big invitation.',
    memoryReplies: {
      care: 'You checked on me last time. Nobody does that enough. I remembered.',
      training: 'You said we should train together. I found a quiet spot by the court.',
      dismissed: 'I remember you laughed off what I said. I am not mad. Just do not mistake a joke for a lie.'
    },
    choices: [
      { id: 'check-in', label: 'Ask how he is really doing', hint: 'Look past the jokes for once.', delta: 9, memory: 'care', memoryLabel: 'You checked in on Bo', reply: 'Bo stops bouncing the ball. For once, he gives you the honest answer instead of the funny one.' },
      { id: 'train', label: 'Invite him to train together', hint: 'Turn nervous energy into teamwork.', delta: 7, memory: 'training', memoryLabel: 'You invited Bo to train', reply: 'Bo lights up. He picks a spot by the court and says tomorrow is officially leg day.' },
      { id: 'brush-off', label: 'Laugh off his concern', hint: 'A joke can land harder than you expect.', delta: -5, memory: 'dismissed', memoryLabel: 'You brushed off Bo’s concern', reply: 'Bo laughs with you, but the smile fades a second early. He will remember that.' }
    ]
  })
});

export const CREW_IDS = Object.freeze(Object.keys(CREW_PROFILES));
const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const cleanName = value => String(value || 'New Yorker').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 22) || 'New Yorker';

export function createInitialSave(playerName = 'New Yorker') {
  return {
    version: 1,
    playerName: cleanName(playerName),
    player: { x: 0, y: 0, z: 10, yaw: 0, health: 100 },
    cityTime: 0,
    crew: Object.fromEntries(CREW_IDS.map(id => [id, { trust: 50, memories: [], lastMemory: null, interactions: 0 }]))
  };
}

export function normalizeSave(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return null;
  const normalized = createInitialSave(value.playerName);
  const player = value.player && typeof value.player === 'object' ? value.player : {};
  normalized.player = {
    x: clamp(player.x, -7, 7, 0), y: 0, z: clamp(player.z, -70, 70, 10),
    yaw: clamp(player.yaw, -100000, 100000, 0), health: clamp(player.health, 0, 100, 100)
  };
  normalized.cityTime = clamp(value.cityTime, 0, 1e9, 0);
  for (const id of CREW_IDS) {
    const entry = value.crew && typeof value.crew[id] === 'object' ? value.crew[id] : {};
    const memories = Array.isArray(entry.memories) ? entry.memories.slice(-6).map(item => ({
      tag: String(item?.tag || '').slice(0, 24), label: String(item?.label || '').slice(0, 80),
      at: clamp(item?.at, 0, 1e9, 0)
    })) : [];
    normalized.crew[id] = {
      trust: clamp(entry.trust, 0, 100, 50), memories,
      lastMemory: typeof entry.lastMemory === 'string' ? entry.lastMemory.slice(0, 24) : null,
      interactions: Math.floor(clamp(entry.interactions, 0, 1e6, 0))
    };
  }
  return normalized;
}

export function loadSave(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? normalizeSave(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function persistSave(storage, value) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  const normalized = normalizeSave(value);
  if (!normalized) return false;
  try { storage.setItem(SAVE_KEY, JSON.stringify(normalized)); return true; }
  catch { return false; }
}

export function getRelationshipLabel(trust) {
  const value = clamp(trust, 0, 100, 50);
  if (value >= 85) return 'INNER CIRCLE';
  if (value >= 65) return 'TRUSTED';
  if (value >= 45) return 'FRIENDS';
  if (value >= 25) return 'WARMING UP';
  return 'DISTANT';
}

export function getCrewDialogue(id, state) {
  const profile = CREW_PROFILES[id];
  if (!profile) return null;
  const entry = state && typeof state === 'object' ? state : {};
  const trust = clamp(entry.trust, 0, 100, 50);
  const lastMemory = typeof entry.lastMemory === 'string' ? entry.lastMemory : null;
  const memory = profile.memoryReplies[lastMemory];
  const lastLabel = Array.isArray(entry.memories) ? entry.memories.at(-1)?.label : '';
  return {
    greeting: memory || profile.firstGreeting,
    memoryLine: lastLabel ? 'REMEMBERS: ' + lastLabel : 'NO SHARED HISTORY YET',
    relationship: getRelationshipLabel(trust), trust,
    choices: profile.choices.map(({ id: choiceId, label, hint }) => ({ id: choiceId, label, hint }))
  };
}

export function recordCrewChoice(save, npcId, choiceId) {
  const profile = CREW_PROFILES[npcId];
  const choice = profile?.choices.find(item => item.id === choiceId);
  const entry = save?.crew?.[npcId];
  if (!choice || !entry) return { ok: false };
  entry.trust = clamp(entry.trust + choice.delta, 0, 100, 50);
  entry.interactions = Math.floor(clamp(entry.interactions, 0, 1e6, 0)) + 1;
  entry.lastMemory = choice.memory;
  entry.memories = Array.isArray(entry.memories) ? entry.memories : [];
  entry.memories.push({ tag: choice.memory, label: choice.memoryLabel, at: clamp(save.cityTime, 0, 1e9, 0) });
  entry.memories = entry.memories.slice(-6);
  return {
    ok: true, reply: choice.reply, memoryLabel: choice.memoryLabel, trust: entry.trust,
    relationship: getRelationshipLabel(entry.trust), interactions: entry.interactions
  };
}

export function getRoutineTarget(npcId, elapsedSeconds = 0) {
  const profile = CREW_PROFILES[npcId];
  if (!profile) return null;
  const elapsed = clamp(elapsedSeconds, 0, 1e9, 0);
  const index = Math.floor(elapsed / 22) % profile.routine.length;
  return { ...profile.routine[index], index };
}
