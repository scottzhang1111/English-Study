import './CompactPageHeader.css';
import SpiritAssistant from '../eigo-quest/SpiritAssistant';

export default function CompactPageHeader({
  title,
  subtitle,
  backgroundImage,
  elementLabel,
  progressText,
  helperImage,
  variant = 'default',
}) {
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
      </div>
      {helperImage ? (
        <SpiritAssistant
          worldName={elementLabel || title}
          mood="talk"
          position="compact-header"
          messages={[
            subtitle || title,
            progressText ? `${progressText} まで進んでいるよ` : 'ここから冒険を続けよう',
            'タップすると応援するよ',
          ]}
        />
      ) : null}
    </header>
  );
}
