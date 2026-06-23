import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const BGM_SRC = '/assets/eigo-quest/home/login.mp3';
const HOME_BGM_SRC = '/assets/eigo-quest/home/login.mp3';
const BGM_VOLUME = 0.25;
const HOME_BGM_VOLUME = 0.25;
const FADE_DURATION_MS = 700;
const FADE_STEP_MS = 40;
export const BGM_ENABLED_STORAGE_KEY = 'eigo_bgm_enabled';
export const BGM_PROMPT_SEEN_STORAGE_KEY = 'eigo_bgm_prompt_seen';

let bgmAudio = null;
let homeBgmAudio = null;
let bgmFadeTimer = null;
let homeBgmFadeTimer = null;

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

function getHomeBgmAudio() {
  if (typeof Audio === 'undefined') return null;
  if (!homeBgmAudio) {
    homeBgmAudio = new Audio(HOME_BGM_SRC);
    homeBgmAudio.loop = true;
    homeBgmAudio.volume = HOME_BGM_VOLUME;
    homeBgmAudio.preload = 'auto';
  }
  return homeBgmAudio;
}

function clampVolume(value) {
  return Math.max(0, Math.min(1, value));
}

function clearFade(which) {
  if (which === 'home') {
    if (homeBgmFadeTimer) window.clearInterval(homeBgmFadeTimer);
    homeBgmFadeTimer = null;
    return;
  }
  if (bgmFadeTimer) window.clearInterval(bgmFadeTimer);
  bgmFadeTimer = null;
}

function fadeAudio(audio, targetVolume, { duration = FADE_DURATION_MS, pauseWhenSilent = false, which = 'global' } = {}) {
  if (!audio || typeof window === 'undefined') return;
  clearFade(which);
  const startVolume = Number(audio.volume || 0);
  const nextTarget = clampVolume(targetVolume);
  const steps = Math.max(1, Math.ceil(duration / FADE_STEP_MS));
  let currentStep = 0;

  const timer = window.setInterval(() => {
    currentStep += 1;
    const progress = Math.min(1, currentStep / steps);
    audio.volume = clampVolume(startVolume + (nextTarget - startVolume) * progress);
    if (progress >= 1) {
      clearFade(which);
      audio.volume = nextTarget;
      if (pauseWhenSilent && nextTarget === 0) {
        audio.pause();
      }
    }
  }, FADE_STEP_MS);

  if (which === 'home') {
    homeBgmFadeTimer = timer;
  } else {
    bgmFadeTimer = timer;
  }
}

function getInitialBgmEnabled() {
  try {
    return localStorage.getItem(BGM_ENABLED_STORAGE_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

function playGlobalAudio({ fadeIn = false } = {}) {
  const audio = getBgmAudio();
  if (!audio) return Promise.resolve(false);
  audio.loop = true;
  if (!fadeIn) {
    clearFade('global');
    audio.volume = BGM_VOLUME;
  }
  if (!audio.paused) {
    if (fadeIn) fadeAudio(audio, BGM_VOLUME, { which: 'global' });
    return Promise.resolve(true);
  }
  if (fadeIn) audio.volume = 0;
  return audio.play()
    .then(() => {
      if (fadeIn) fadeAudio(audio, BGM_VOLUME, { which: 'global' });
      return true;
    })
    .catch((err) => {
      console.warn('BGM playback failed', err);
      return false;
    });
}

const BgmContext = createContext(null);

export function BgmProvider({ children }) {
  const [bgmEnabled, setBgmEnabledState] = useState(getInitialBgmEnabled);

  const setBgmEnabled = useCallback((enabled) => {
    const nextEnabled = Boolean(enabled);
    setBgmEnabledState(nextEnabled);
    try {
      localStorage.setItem(BGM_ENABLED_STORAGE_KEY, nextEnabled ? 'true' : 'false');
    } catch (err) {
      // Keep the app usable when localStorage is unavailable.
    }
    if (nextEnabled) {
      playGlobalAudio({ fadeIn: true });
      return;
    }
    if (bgmAudio) {
      clearFade('global');
      bgmAudio.pause();
    }
    if (homeBgmAudio) {
      clearFade('home');
      homeBgmAudio.pause();
    }
  }, []);

  useEffect(() => {
    if (bgmEnabled) playGlobalAudio({ fadeIn: true });
  }, [bgmEnabled]);

  const startBgm = useCallback((options = {}) => {
    if (!bgmEnabled) return Promise.resolve(false);
    return playGlobalAudio(options);
  }, [bgmEnabled]);

  const playHomeBgm = useCallback(() => {
    if (!bgmEnabled) return Promise.resolve(false);
    const globalAudio = getBgmAudio();
    if (globalAudio && !globalAudio.paused) {
      fadeAudio(globalAudio, 0, { pauseWhenSilent: true, which: 'global' });
    }

    const audio = getHomeBgmAudio();
    if (!audio) return Promise.resolve(false);
    audio.loop = true;
    if (!audio.paused) {
      fadeAudio(audio, HOME_BGM_VOLUME, { which: 'home' });
      return Promise.resolve(true);
    }
    audio.volume = 0;
    return audio.play()
      .then(() => {
        fadeAudio(audio, HOME_BGM_VOLUME, { which: 'home' });
        return true;
      })
      .catch((err) => {
        console.warn('Home BGM playback failed', err);
        return false;
      });
  }, [bgmEnabled]);

  const resumeGlobalBgm = useCallback(() => {
    if (!bgmEnabled) return Promise.resolve(false);
    const homeAudio = getHomeBgmAudio();
    if (homeAudio && !homeAudio.paused) {
      fadeAudio(homeAudio, 0, { pauseWhenSilent: true, which: 'home' });
    }
    return startBgm({ fadeIn: true });
  }, [bgmEnabled, startBgm]);

  const toggleBgm = useCallback(() => {
    setBgmEnabled(!bgmEnabled);
  }, [bgmEnabled, setBgmEnabled]);

  const value = useMemo(
    () => ({
      bgmEnabled,
      setBgmEnabled,
      toggleBgm,
      // Keep the existing login controls compatible with the global BGM setting.
      soundEnabled: bgmEnabled,
      setSoundEnabled: setBgmEnabled,
      startBgm,
      playHomeBgm,
      resumeGlobalBgm,
    }),
    [bgmEnabled, playHomeBgm, resumeGlobalBgm, setBgmEnabled, startBgm, toggleBgm],
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
