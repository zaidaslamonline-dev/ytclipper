export const CITY_PROGRESS_KEY = 'stickcity-city-progress-v1';
export const CITY_DISTRICTS = Object.freeze([
  Object.freeze({ id: 'midtown', name: 'Midtown Hub', detail: 'Corner Diner · crew meetup', x: 0, z: 10, pinX: 50, pinY: 14, icon: '🏙️' }),
  Object.freeze({ id: 'transit', name: 'Transit Plaza', detail: 'Subway relays · first signal trace', x: 0, z: -28, pinX: 25, pinY: 39, icon: '🚇' }),
  Object.freeze({ id: 'riverside', name: 'Riverside Walk', detail: 'Waterfront service path · second trace', x: 4, z: -44, pinX: 75, pinY: 65, icon: '🌉' }),
  Object.freeze({ id: 'signal', name: 'Signal Exchange', detail: 'Old broadcast mast · final trace', x: 0, z: -64, pinX: 50, pinY: 88, icon: '📡' })
]);
export const SIGNAL_CLUES = Object.freeze([
  Object.freeze({ id: 'subway-relay', districtId: 'transit', label: 'Subway relay', description: 'A maintenance relay is repeating a burst that should not exist.', x: 2.5, z: -28, color: 0x4fd5e8 }),
  Object.freeze({ id: 'river-echo', districtId: 'riverside', label: 'River echo', description: 'A waterfront receiver caught the same signal beneath the bridge.', x: 6.5, z: -44, color: 0x65e2b1 }),
  Object.freeze({ id: 'roofline-key', districtId: 'signal', label: 'Roofline key', description: 'The old broadcast mast contains the missing encryption key.', x: 2.5, z: -64, color: 0xf3c45f })
]);
const CLUE_IDS = new Set(SIGNAL_CLUES.map(clue => clue.id));
export function createInitialCityProgress() { return { version: 1, clues: [], ending: null }; }
export function normalizeCityProgress(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return null;
  const clues = Array.isArray(value.clues) ? [...new Set(value.clues.filter(id => CLUE_IDS.has(id)))].slice(0, SIGNAL_CLUES.length) : [];
  const ending = value.ending === 'broadcast' || value.ending === 'contain' ? value.ending : null;
  return { version: 1, clues, ending: clues.length === SIGNAL_CLUES.length ? ending : null };
}
export function loadCityProgress(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try { const raw = storage.getItem(CITY_PROGRESS_KEY); return raw ? normalizeCityProgress(JSON.parse(raw)) : null; } catch { return null; }
}
export function persistCityProgress(storage, value) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  const normalized = normalizeCityProgress(value);
  if (!normalized) return false;
  try { storage.setItem(CITY_PROGRESS_KEY, JSON.stringify(normalized)); return true; } catch { return false; }
}
export function collectSignalClue(progress, clueId) {
  const current = normalizeCityProgress(progress) || createInitialCityProgress();
  if (!CLUE_IDS.has(clueId)) return { ok: false, reason: 'unknown-clue', progress: current };
  if (current.ending) return { ok: false, reason: 'case-closed', progress: current };
  if (current.clues.includes(clueId)) return { ok: false, reason: 'already-collected', progress: current };
  const next = { ...current, clues: [...current.clues, clueId] };
  return { ok: true, progress: next, complete: next.clues.length === SIGNAL_CLUES.length, collected: clueId };
}
export function resolveSignalCase(progress, choice) {
  const current = normalizeCityProgress(progress);
  if (!current || current.clues.length !== SIGNAL_CLUES.length) return { ok: false, reason: 'evidence-incomplete' };
  if (current.ending) return { ok: false, reason: 'already-resolved' };
  const outcomes = {
    broadcast: { ending: 'broadcast', bondId: 'ria', trustDelta: 8, memoryTag: 'signal-broadcast', memoryLabel: 'You let the neighbourhood hear the truth', message: 'THE CITY KNOWS. Ria is already sharing the evidence with the block.' },
    contain: { ending: 'contain', bondId: 'milo', trustDelta: 8, memoryTag: 'signal-contained', memoryLabel: 'You kept the signal inside the crew', message: 'QUIETLY CONTAINED. Milo has a safer plan for what comes next.' }
  };
  const outcome = outcomes[choice];
  if (!outcome) return { ok: false, reason: 'invalid-choice' };
  return { ok: true, progress: { ...current, ending: outcome.ending }, ...outcome };
}
export function getSignalMissionSummary(progress) {
  const current = normalizeCityProgress(progress) || createInitialCityProgress();
  if (current.ending === 'broadcast') return 'CASE CLOSED · THE NEIGHBOURHOOD HAS THE TRUTH';
  if (current.ending === 'contain') return 'CASE CLOSED · THE CREW KEPT IT QUIET';
  return 'SIGNAL CASE · ' + current.clues.length + '/' + SIGNAL_CLUES.length + ' TRACES SECURED';
}
