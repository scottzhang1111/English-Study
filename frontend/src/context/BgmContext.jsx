import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const BGM_SRC = '/assets/eigo-quest/home/login.mp3';
const BGM_VOLUME = 0.3;
const SOUND_ENABLED_STORAGE_KEY = 'sound_enabled';

let bgmAudio = null;

function getBgmAudio() {
  if (typeof Audio === 'undefined') return null;
  if (!bgmAudio) {
    bgmAudio = new Audio(BGM_SRC);
    bgmAudio.loop = true;
    bgmAudio.volume = BGM_VOLUME;
    bgmAudio.preload = 'auto';
  }
  return bgmAudio;
}

function getInitialSoundEnabled() {
  try {
    return localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== 'false';
  } catch (err) {
    return true;
  }
}

const BgmContext = createContext(null);

export function BgmProvider({ children }) {
  const [soundEnabled, setSoundEnabledState] = useState(getInitialSoundEnabled);

  const setSoundEnabled = useCallback((enabled) => {
    const nextEnabled = Boolean(enabled);
    setSoundEnabledState(nextEnabled);
    try {
      localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, nextEnabled ? 'true' : 'false');
    } catch (err) {
      // Keep the app usable when localStorage is unavailable.
    }
    if (!nextEnabled && bgmAudio) {
      bgmAudio.pause();
    }
  }, []);

  const startBgm = useCallback(() => {
    if (!soundEnabled) return Promise.resolve(false);
    const audio = getBgmAudio();
    if (!audio) return Promise.resolve(false);
    audio.loop = true;
    audio.volume = BGM_VOLUME;
    if (!audio.paused) return Promise.resolve(true);
    return audio.play()
      .then(() => true)
      .catch((err) => {
        console.warn('BGM playback failed', err);
        return false;
      });
  }, [soundEnabled]);

  const value = useMemo(
    () => ({
      soundEnabled,
      setSoundEnabled,
      startBgm,
    }),
    [setSoundEnabled, soundEnabled, startBgm],
  );

  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
}

export function useBgm() {
  const context = useContext(BgmContext);
  if (!context) {
    throw new Error('useBgm must be used inside BgmProvider');
  }
  return context;
}
