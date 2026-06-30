const SFX_ENABLED_KEY = 'eigoQuestSfxEnabled';

const BATTLE_SFX_MAP = {
  wind_slash: {
    src: '/assets/eigo-quest/effects/wind/wind-cut-impact.mp3',
    volume: 0.55,
  },
  gale_thrust: {
    src: '/assets/eigo-quest/effects/wind/wind-pierce-impact.mp3',
    volume: 0.55,
  },
  cyclone_combo: {
    src: '/assets/eigo-quest/effects/wind/wind-combo-impact.mp3',
    volume: 0.5,
  },
  wind_blessing: {
    src: '/assets/eigo-quest/effects/wind/wind-blessing-aura.mp3',
    volume: 0.45,
  },
  boss_counter: {
    src: '/assets/eigo-quest/effects/wind/boss-claw.mp3',
    volume: 0.62,
  },
};

const audioCache = new Map();

function canUseAudio() {
  return typeof window !== 'undefined' && typeof window.Audio === 'function';
}

function getCachedAudio(motion) {
  const config = BATTLE_SFX_MAP[motion];
  if (!config || !canUseAudio()) return null;

  if (!audioCache.has(motion)) {
    const audio = new window.Audio(config.src);
    audio.preload = 'auto';
    audio.volume = config.volume;
    audioCache.set(motion, audio);
  }

  return audioCache.get(motion);
}

export function getBattleSfxEnabled() {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(SFX_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setBattleSfxEnabled(enabled) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SFX_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage failures; sound can still use the default enabled state.
  }
}

export function preloadBattleSfx() {
  if (!canUseAudio()) return;

  Object.keys(BATTLE_SFX_MAP).forEach((motion) => {
    const audio = getCachedAudio(motion);
    if (!audio) return;

    try {
      audio.load();
    } catch {
      // Missing or blocked audio should never break the battle.
    }
  });
}

export function playBattleSfx(motion) {
  if (!getBattleSfxEnabled()) return;

  const audio = getCachedAudio(motion);
  if (!audio) return;

  try {
    const instance = audio.cloneNode();
    instance.volume = audio.volume;
    instance.currentTime = 0;
    instance.play().catch(() => {});
  } catch {
    // Browser audio policies and missing files should fail silently.
  }
}
