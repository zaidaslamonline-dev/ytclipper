export const AFTERMATH_KEY = 'stickcity-signal-aftermath-v1';

export const AFTERMATH_CLUES = Object.freeze([
  Object.freeze({
    id: 'witness-cache', ending: 'broadcast', districtId: 'midtown',
    label: 'Witness cache', description: 'A shopkeeper left a sealed witness receipt beside the diner route.',
    x: 0, z: 13, color: 0xf0c45e
  }),
  Object.freeze({
    id: 'shadow-relay', ending: 'contain', districtId: 'transit',
    label: 'Shadow relay', description: 'A quiet receiver caught one final copy of the encrypted burst.',
    x: 0, z: -28, color: 0x54cfe0
  })
]);

const CHOICES = Object.freeze({
  broadcast: Object.freeze([
    Object.freeze({
      id: 'protect-witness', title: 'Protect the witness',
      hint: 'Keep the courier safe. Ria earns the block’s trust.',
      bondId: 'ria', delta: 6, memoryTag: 'witness-protected',
      memoryLabel: 'You protected the witness instead of exposing their identity',
      message: 'WITNESS SAFE. Ria gets the courier out through the night market.'
    }),
    Object.freeze({
      id: 'publish-receipt', title: 'Publish the receipt',
      hint: 'Give Milo a verifiable chain of evidence.',
      bondId: 'milo', delta: 6, memoryTag: 'receipt-published',
      memoryLabel: 'You and Milo published a verifiable chain of evidence',
      message: 'RECEIPT VERIFIED. Milo gives the neighbourhood proof it can check.'
    })
  ]),
  contain: Object.freeze([
    Object.freeze({
      id: 'share-key', title: 'Share the key with the crew',
      hint: 'Keep the signal quiet, but let your people prepare.',
      bondId: 'milo', delta: 6, memoryTag: 'key-shared',
      memoryLabel: 'You shared the shadow key with the crew',
      message: 'KEY SHARED. Milo locks the receiver down and starts tracing its source.'
    }),
    Object.freeze({
      id: 'burn-key', title: 'Destroy the shadow key',
      hint: 'Remove the copy before anyone else can use it.',
      bondId: 'bo', delta: 6, memoryTag: 'key-burned',
      memoryLabel: 'You and Bo destroyed the last shadow key',
      message: 'KEY BURNED. Bo destroys the copy before it can be traced back to the block.'
    })
  ])
});

const ENDINGS = new Set(['broadcast', 'contain']);
const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export function createInitialAftermathState() {
  return { version: 1, branch: null, clueCollected: false, choice: null };
}

export function normalizeAftermathState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return null;
  const branch = ENDINGS.has(value.branch) ? value.branch : null;
  const allowed = branch ? CHOICES[branch].some(choice => choice.id === value.choice) : false;
  const clueCollected = branch !== null && value.clueCollected === true;
  return {
    version: 1,
    branch,
    clueCollected,
    choice: allowed && clueCollected ? value.choice : null
  };
}

export function loadAftermathState(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(AFTERMATH_KEY);
    return raw ? normalizeAftermathState(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function persistAftermathState(storage, value) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  const normalized = normalizeAftermathState(value);
  if (!normalized) return false;
  try { storage.setItem(AFTERMATH_KEY, JSON.stringify(normalized)); return true; }
  catch { return false; }
}

export function unlockAftermath(state, ending) {
  const current = normalizeAftermathState(state) || createInitialAftermathState();
  if (!ENDINGS.has(ending) || current.branch) return current;
  return { ...current, branch: ending };
}

export function getAftermathClue(state) {
  const current = normalizeAftermathState(state);
  if (!current?.branch || current.clueCollected || current.choice) return null;
  return AFTERMATH_CLUES.find(clue => clue.ending === current.branch) || null;
}

export function getAftermathClueById(id) {
  return AFTERMATH_CLUES.find(clue => clue.id === id) || null;
}

export function collectAftermathClue(state, clueId) {
  const current = normalizeAftermathState(state) || createInitialAftermathState();
  const clue = getAftermathClue(current);
  if (!clue) return { ok: false, reason: current.choice ? 'chapter-complete' : current.clueCollected ? 'already-collected' : 'branch-locked', state: current };
  if (clue.id !== clueId) return { ok: false, reason: 'wrong-branch-clue', state: current };
  return { ok: true, state: { ...current, clueCollected: true }, clue };
}

export function getAftermathChoices(state) {
  const current = normalizeAftermathState(state);
  if (!current?.branch || !current.clueCollected || current.choice) return [];
  return CHOICES[current.branch].map(({ id, title, hint }) => ({ id, title, hint }));
}

export function resolveAftermathChoice(state, choiceId) {
  const current = normalizeAftermathState(state);
  if (!current?.branch) return { ok: false, reason: 'branch-locked' };
  if (!current.clueCollected) return { ok: false, reason: 'evidence-incomplete' };
  if (current.choice) return { ok: false, reason: 'already-resolved' };
  const outcome = CHOICES[current.branch].find(choice => choice.id === choiceId);
  if (!outcome) return { ok: false, reason: 'invalid-choice' };
  return {
    ok: true,
    state: { ...current, choice: outcome.id },
    ...outcome,
    ending: current.branch
  };
}

export function getAftermathPresentation(state) {
  const current = normalizeAftermathState(state);
  if (!current?.branch || !current.clueCollected || current.choice) return null;
  if (current.branch === 'broadcast') return {
    kicker: 'CHAPTER 01 / THE BLOCK KNOWS',
    title: 'Who gets protected?',
    description: 'The broadcast brought a witness forward. Their receipt can prove who routed the signal, but exposing them could put the whole block at risk. Decide what the crew does with the lead.',
    choices: getAftermathChoices(current)
  };
  return {
    kicker: 'CHAPTER 01 / QUIET CHANNEL',
    title: 'What survives the silence?',
    description: 'The signal is contained, but a shadow copy remains. You can share its key with the crew or destroy the last copy before someone follows it home.',
    choices: getAftermathChoices(current)
  };
}

export function getAftermathSummary(state) {
  const current = normalizeAftermathState(state);
  if (!current?.branch) return null;
  if (current.choice) {
    const choice = CHOICES[current.branch].find(item => item.id === current.choice);
    return 'CHAPTER 01 COMPLETE · ' + choice.title.toUpperCase();
  }
  const clue = AFTERMATH_CLUES.find(item => item.ending === current.branch);
  if (current.clueCollected) return 'AFTERMATH · CREW DECISION READY';
  return 'AFTERMATH · RECOVER ' + clue.label.toUpperCase();
}
