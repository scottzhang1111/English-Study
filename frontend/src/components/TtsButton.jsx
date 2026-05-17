import { speakEnglish } from '../utils/tts';

export default function TtsButton({ text, label = 'Listen', className = '', disabled = false }) {
  const canSpeak = Boolean(String(text || '').trim()) && !disabled;

  return (
    <button
      type="button"
      onClick={() => speakEnglish(text)}
      disabled={!canSpeak}
      className={`ghost-button inline-flex items-center justify-center px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      aria-label={`${label} audio`}
      title={`${label} audio`}
    >
      {label}
    </button>
  );
}
