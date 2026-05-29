import { useMemo, useState } from 'react';
import './CompactPageHeader.css';

export default function CompactPageHeader({
  title,
  subtitle,
  backgroundImage,
  elementLabel,
  progressText,
  progressValue,
  progressMax,
  helperImage,
  guidanceText,
  variant = 'default',
}) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const guidanceLines = useMemo(() => {
    if (Array.isArray(guidanceText)) return guidanceText.filter(Boolean).slice(0, 3);
    if (guidanceText) return [guidanceText];
    return [];
  }, [guidanceText]);
  const progressPercent = Number(progressMax) > 0
    ? Math.min(100, Math.max(0, (Number(progressValue) / Number(progressMax)) * 100))
    : null;
  const style = backgroundImage
    ? { '--compact-page-header-bg': `url("${backgroundImage}")` }
    : undefined;

  return (
    <header className={`compact-page-header compact-page-header--${variant}`} style={style}>
      <div className="compact-page-header__overlay" aria-hidden="true" />
      <div className="compact-page-header__content">
        <div className="compact-page-header__copy">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {(elementLabel || progressText) ? (
          <div className="compact-page-header__meta" aria-label="Page status">
            {elementLabel ? <span>{elementLabel}</span> : null}
            {progressText ? <span>{progressText}</span> : null}
          </div>
        ) : null}
        {progressPercent !== null ? (
          <div className="compact-page-header__progress" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        ) : null}
      </div>
      {helperImage ? (
        <div className={`compact-page-header__spirit ${guidanceOpen ? 'is-open' : ''}`}>
          {guidanceOpen && guidanceLines.length ? (
            <div className="compact-page-header__guidance" role="status">
              {guidanceLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="compact-page-header__helper-button"
            onClick={() => setGuidanceOpen((open) => !open)}
            aria-expanded={guidanceOpen}
            aria-label="ガイドを表示"
          >
            <img src={helperImage} alt="" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </header>
  );
}
