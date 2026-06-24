import './EQOfficialComponents.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export default function EQProgressBar({
  value = 0,
  max = 100,
  label,
  className = '',
  showText = true,
}) {
  const safeMax = Math.max(0, toNumber(max, 100));
  const safeValue = Math.min(Math.max(0, toNumber(value, 0)), safeMax);
  const percent = safeMax > 0 ? Math.round((safeValue / safeMax) * 100) : 0;
  const text = label || `${safeValue}/${safeMax}`;

  return (
    <div
      className={cx('eq-progress-bar-official', className)}
      role="progressbar"
      aria-label={label || 'Progress'}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      style={{ '--eq-progress-value': `${percent}%` }}
    >
      <div className="eq-progress-bar-official__track">
        <div className="eq-progress-bar-official__fill" />
      </div>
      {showText ? <span className="eq-progress-bar-official__text">{text}</span> : null}
    </div>
  );
}
