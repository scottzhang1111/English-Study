import { useBgm } from '../../context/BgmContext';
import './BgmToggle.css';

export default function BgmToggle({ className = '', showLabel = false }) {
  const { bgmEnabled, toggleBgm } = useBgm();
  const label = bgmEnabled ? 'BGMをオフにする' : 'BGMをオンにする';

  return (
    <button
      type="button"
      className={`eq-bgm-toggle ${showLabel ? 'eq-bgm-toggle--labeled' : ''} ${bgmEnabled ? 'is-enabled' : ''} ${className}`.trim()}
      onClick={toggleBgm}
      aria-label={label}
      aria-pressed={bgmEnabled}
      title={label}
    >
      <span className="eq-bgm-toggle__icon" aria-hidden="true">{bgmEnabled ? '🔊' : '🔇'}</span>
      {showLabel ? <span>{bgmEnabled ? 'オン' : 'オフ'}</span> : null}
    </button>
  );
}
