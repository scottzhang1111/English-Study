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
  const [guidanceIndex, setGuidanceIndex] = useState(0);

  const guidanceLines = useMemo(() => {
    if (!guidanceText) return [];
    const lines = Array.isArray(guidanceText)
      ? guidanceText
      : String(guidanceText).split('\n');

    return lines.filter(Boolean).slice(0, 2);
  }, [guidanceText]);
  const activeGuidance = guidanceLines[guidanceIndex % Math.max(1, guidanceLines.length)] || '';
  const headerGuidance = activeGuidance || subtitle || '';

  const progressPercent = useMemo(() => {
    const value = Number(progressValue);
    const max = Number(progressMax);
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.min(100, Math.max(0, (value / max) * 100));
  }, [progressValue, progressMax]);
  const hasMeta = Boolean(elementLabel || progressText);

  return (
    <section
      className={`compact-page-header compact-page-header--${variant}`}
      style={{
        backgroundImage: backgroundImage
          ? `linear-gradient(90deg, rgba(4,8,24,.82), rgba(4,8,24,.48)), url("${backgroundImage}")`
          : undefined,
      }}
    >
      <div className="compact-page-header__content">
        <h1 className="compact-page-header__title">{title}</h1>

        {headerGuidance ? (
          <p className="compact-page-header__subtitle">{headerGuidance}</p>
        ) : null}

        {hasMeta ? (
          <div className="compact-page-header__meta">
            {elementLabel ? (
              <span className="compact-page-header__pill">{elementLabel}</span>
            ) : null}

            {progressText ? (
              <span className="compact-page-header__progress-text">
                {progressText}
              </span>
            ) : null}
          </div>
        ) : null}

        {progressMax ? (
          <div className="compact-page-header__bar" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        ) : null}
      </div>

      {helperImage ? (
        <div className="compact-page-header__helper">
          <button
            type="button"
            className="compact-page-header__helper-button"
            onClick={() => setGuidanceIndex((current) => (guidanceLines.length > 1 ? current + 1 : current))}
            aria-label="ガイダンスを表示"
          >
            <img src={helperImage} alt="" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
