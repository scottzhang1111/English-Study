import { API_BASE_URL } from '../api';

let currentAudio = null;

function speakWithBrowser(text, lang = 'en-US') {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export async function speakEnglish(text, lang = 'en') {
  const cleanText = String(text || '').trim();
  if (!cleanText || typeof window === 'undefined') return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  try {
    const url = `${API_BASE_URL}/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(lang)}`;
    currentAudio = new Audio(url);
    await currentAudio.play();
  } catch (err) {
    speakWithBrowser(cleanText, lang === 'en' ? 'en-US' : lang);
  }
}
