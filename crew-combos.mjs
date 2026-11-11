import { CREW_ASSISTS, CREW_PROFILES } from './crew-system.mjs';

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const CREW_COMBOS = Object.freeze([
  Object.freeze({ id: 'milo-ria', members: Object.freeze(['milo', 'ria']), label: 'GHOST PROTOCOL', threshold: 70, cooldown: 24, damage: 34, stun: 2.2, knockback: 1.2, heal: 10, color: 0x69c9ed }),
  Object.freeze({ id: 'milo-bo', members: Object.freeze(['milo', 'bo']), label: 'CORNER BREAKER', threshold: 70, cooldown: 24, damage: 46, stun: 1.15, knockback: 4.8, heal: 0, color: 0xf2b85e }),
  Object.freeze({ id: 'ria-bo', members: Object.freeze(['ria', 'bo']), label: 'CROSSCURRENT', threshold: 70, cooldown: 24, damage: 38, stun: 1.65, knockback: 2.5, heal: 14, color: 0x66d8b6 })
]);

export function getCrewComboOptions(save, elapsedSeconds = 0) {
  const now = Math.max(0, number(elapsedSeconds));
  return CREW_COMBOS.map(combo => {
    const entries = combo.members.map(id => save?.crew?.[id] || {});
    const trust = Math.min(...entries.map(entry => Math.max(0, Math.min(100, number(entry.trust, 50)))));
    const unlocked = trust >= combo.threshold;
    let remaining = 0;
    if (unlocked) {
      remaining = Math.max(0, ...entries.map((entry, index) => {
        if (entry.lastAssistAt == null) return 0;
        const elapsed = Math.max(0, now - Math.max(0, number(entry.lastAssistAt)));
        const individualCooldown = CREW_ASSISTS[combo.members[index]]?.cooldown || 0;
        return Math.max(combo.cooldown - elapsed, individualCooldown - elapsed);
      }));
    }
    return { ...combo, trust, unlocked, ready: unlocked && remaining <= 0, remaining: Math.ceil(remaining) };
  });
}

export function recordCrewCombo(save, comboId, elapsedSeconds = 0) {
  const combo = CREW_COMBOS.find(item => item.id === comboId);
  if (!combo) return { ok: false, reason: 'unknown-combo' };
  if (!save?.crew || combo.members.some(id => !save.crew[id] || typeof save.crew[id] !== 'object')) {
    return { ok: false, reason: 'crew-state' };
  }
  const status = getCrewComboOptions(save, elapsedSeconds).find(item => item.id === comboId);
  if (!status.unlocked) return { ok: false, reason: 'trust', required: combo.threshold };
  if (!status.ready) return { ok: false, reason: 'cooldown', remaining: status.remaining };

  const at = Math.max(0, number(elapsedSeconds));
  const memoryLabels = [];
  for (const id of combo.members) {
    const entry = save.crew[id];
    const partnerId = combo.members.find(other => other !== id);
    const partnerName = CREW_PROFILES[partnerId]?.name || partnerId;
    const memoryLabel = combo.label + ' · ' + partnerName + ' teamed up with you';
    entry.lastAssistAt = at;
    entry.lastMemory = 'assist';
    entry.interactions = Math.max(0, Math.floor(number(entry.interactions))) + 1;
    entry.memories = Array.isArray(entry.memories) ? entry.memories : [];
    entry.memories.push({ tag: 'assist', label: memoryLabel, at });
    entry.memories = entry.memories.slice(-6);
    memoryLabels.push({ id, label: memoryLabel });
  }
  return { ok: true, ...combo, memoryLabels };
}
