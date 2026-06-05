// ── SettingsStore ───────────────────────────────────────────────────────────
// Single source of truth for detection params: defaults, localStorage keys, and
// typed load/save. The config app writes here; the main app reads here to seed
// the detector. The detector itself stays storage-agnostic — it only ever sees
// the plain object returned by load().
//
//   const params = SettingsStore.load();        // merged over defaults
//   const det = new CelloDetector(params);
//   SettingsStore.save({ threshold: 20 });       // persist a partial update

const SettingsStore = {
  DEFAULTS: {
    threshold:        15,
    attackMs:         60,
    stabilityEnabled: true,
    toleranceCents:   30,
    durationMs:       200,
  },

  // Param name → localStorage key. Keys match the original pre-refactor names,
  // so existing tuned values carry over with no migration.
  KEYS: {
    threshold:        'detection.threshold',
    attackMs:         'detection.attackMs',
    stabilityEnabled: 'stability.enabled',
    toleranceCents:   'stability.toleranceCents',
    durationMs:       'stability.durationMs',
  },

  load() {
    const d = this.DEFAULTS, k = this.KEYS;
    const num = (key, def) => {
      const v = localStorage.getItem(key);
      return v === null ? def : parseInt(v, 10);
    };
    const bool = (key, def) => {
      const v = localStorage.getItem(key);
      return v === null ? def : v !== 'false';
    };
    return {
      threshold:        num(k.threshold,        d.threshold),
      attackMs:         num(k.attackMs,         d.attackMs),
      stabilityEnabled: bool(k.stabilityEnabled, d.stabilityEnabled),
      toleranceCents:   num(k.toleranceCents,   d.toleranceCents),
      durationMs:       num(k.durationMs,       d.durationMs),
    };
  },

  // Persist a partial params object. Unknown keys are ignored.
  save(partial) {
    for (const [name, val] of Object.entries(partial)) {
      const key = this.KEYS[name];
      if (key) localStorage.setItem(key, val);
    }
  },
};
