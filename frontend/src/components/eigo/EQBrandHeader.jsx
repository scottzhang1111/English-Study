export default function EQBrandHeader({
  iconSrc = '/assets/homepage-icon.png',
  iconAlt = '英語クエスト',
  fallbackIcon = 'EQ',
  title = '英語クエスト',
  subtitle = '楽しく続ける英語学習',
  dateLabel,
  className = '',
}) {
  return (
    <header className={`eq-brand-header ${className}`.trim()}>
      <div className="eq-brand-icon" aria-hidden={!iconSrc}>
        {iconSrc ? <img src={iconSrc} alt={iconAlt} /> : fallbackIcon}
      </div>
      <div className="eq-brand-copy">
        <h1 className="eq-brand-title">{title}</h1>
        <p className="eq-brand-subtitle">{subtitle}</p>
      </div>
      {dateLabel ? <div className="eq-date-pill">{dateLabel}</div> : null}
    </header>
  );
}
