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
  boss_encounter_mini_1: {
    src: '/assets/eigo-quest/battle-ui/boss-mini-1.mp3',
    volume: 0.7,
  },
  boss_encounter_mini_2: {
    src: '/assets/eigo-quest/battle-ui/boss-mini-2.mp3',
    volume: 0.7,
  },
  boss_encounter_final: {
    src: '/assets/eigo-quest/battle-ui/boss-final.mp3',
    volume: 0.68,
  },
};


const GENERIC_SKILL_SFX = {
  slash: BATTLE_SFX_MAP.wind_slash,
  projectile: BATTLE_SFX_MAP.gale_thrust,
  combo: BATTLE_SFX_MAP.cyclone_combo,
  blessing: BATTLE_SFX_MAP.wind_blessing,
  vertical: BATTLE_SFX_MAP.gale_thrust,
  burst: BATTLE_SFX_MAP.cyclone_combo,
};

['fire', 'water', 'thunder', 'wood', 'rock', 'light', 'shadow'].forEach((element) => {
  Object.entries(GENERIC_SKILL_SFX).forEach(([template, config]) => {
    BATTLE_SFX_MAP[`${element}_${template}`] = config;
  });
});

const audioCache = new Map();
let activeBossBattleAudio = null;

function isBossBattleAudioKey(motion) {
  return String(motion || '').startsWith('boss_encounter_');
}

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

export function stopBossBattleAudio() {
  if (!activeBossBattleAudio) return;

  try {
    activeBossBattleAudio.pause();
    activeBossBattleAudio.currentTime = 0;
    activeBossBattleAudio.src = '';
    activeBossBattleAudio.load?.();
  } catch {
    // Stopping battle audio should never interrupt navigation.
  } finally {
    activeBossBattleAudio = null;
  }
}

export function playBattleSfx(motion) {
  if (isBossBattleAudioKey(motion)) {
    stopBossBattleAudio();
  }

  if (!getBattleSfxEnabled()) return Promise.resolve(false);

  const audio = getCachedAudio(motion);
  if (!audio) return Promise.resolve(false);

  try {
    if (isBossBattleAudioKey(motion)) {
      const battleAudio = audio.cloneNode();
      battleAudio.volume = audio.volume;
      battleAudio.currentTime = 0;
      battleAudio.loop = false;
      activeBossBattleAudio = battleAudio;

      const playResult = battleAudio.play();

      if (playResult && typeof playResult.then === 'function') {
        return playResult
          .then(() => true)
          .catch(() => {
            if (activeBossBattleAudio === battleAudio) {
              stopBossBattleAudio();
            }
            return false;
          });
      }

      return Promise.resolve(true);
    }

    const instance = audio.cloneNode();
    instance.volume = audio.volume;
    instance.currentTime = 0;
    instance.loop = false;
    const playResult = instance.play();

    if (playResult && typeof playResult.then === 'function') {
      return playResult.then(() => true).catch(() => false);
    }

    return Promise.resolve(true);
  } catch {
    // Browser audio policies and missing files should fail silently.
    return Promise.resolve(false);
  }
}
