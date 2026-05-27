import './EQFantasyPrimitives.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

const toneColorMap = {
  amber: '#ffb72e',
  blue: '#5f8dff',
  cyan: '#35d9ff',
  gold: '#ffd35a',
  green: '#54e6a8',
  mint: '#54e6a8',
  purple: '#a569ff',
  rose: '#ff6b8a',
  sky: '#77d7ff',
  violet: '#c178ff',
};

function toneStyle(tone, style) {
  const accent = toneColorMap[tone] || tone;

  return tone
    ? { '--eq-fantasy-accent': accent, ...style }
    : style;
}

function renderIcon(icon, className) {
  if (!icon) return null;
  if (typeof icon !== 'string') return <span className={className}>{icon}</span>;

  return (
    <span className={className} aria-hidden="true">
      {icon}
    </span>
  );
}

export function EQPageHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  meta,
  actions,
  children,
  className = '',
  ...props
}) {
  return (
    <header className={cx('eq-fantasy-page-header', className)} {...props}>
      <div className="eq-fantasy-page-header__main">
        {renderIcon(icon, 'eq-fantasy-page-header__icon')}
        <div className="eq-fantasy-page-header__copy">
          {eyebrow ? <span className="eq-fantasy-eyebrow">{eyebrow}</span> : null}
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
          {meta ? <div className="eq-fantasy-page-header__meta">{meta}</div> : null}
        </div>
        {actions ? <div className="eq-fantasy-page-header__actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function EQPanel({
  as: Component = 'section',
  title,
  eyebrow,
  footer,
  children,
  className = '',
  tone = '#ffd35a',
  style,
  ...props
}) {
  return (
    <Component
      className={cx('eq-card eq-fantasy-panel', className)}
      style={toneStyle(tone, style)}
      {...props}
    >
      {eyebrow || title ? (
        <div className="eq-fantasy-panel__header">
          {eyebrow ? <span className="eq-fantasy-eyebrow">{eyebrow}</span> : null}
          {title ? <h2>{title}</h2> : null}
        </div>
      ) : null}
      {children}
      {footer ? <div className="eq-fantasy-panel__footer">{footer}</div> : null}
    </Component>
  );
}

export function EQQuestCard({
  as: Component = 'article',
  icon,
  title,
  subtitle,
  meta,
  badges,
  action,
  children,
  featured = false,
  className = '',
  tone = '#ffd35a',
  style,
  ...props
}) {
  return (
    <Component
      className={cx(
        'eq-fantasy-quest-card',
        featured && 'is-featured',
        className,
      )}
      style={toneStyle(tone, style)}
      {...props}
    >
      {renderIcon(icon, 'eq-fantasy-quest-card__icon')}
      <div className="eq-fantasy-quest-card__body">
        <div className="eq-fantasy-quest-card__topline">
          {title ? <h2>{title}</h2> : null}
          {badges ? <div className="eq-fantasy-badge-row">{badges}</div> : null}
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <div className="eq-fantasy-quest-card__meta">{meta}</div> : null}
        {children}
      </div>
      {action ? <div className="eq-fantasy-quest-card__action">{action}</div> : null}
    </Component>
  );
}

export function EQInfoCard({
  as: Component = 'section',
  icon,
  title,
  value,
  badges,
  footer,
  children,
  className = '',
  tone = '#ffd35a',
  style,
  ...props
}) {
  return (
    <Component
      className={cx('eq-card eq-fantasy-info-card', className)}
      style={toneStyle(tone, style)}
      {...props}
    >
      <div className="eq-fantasy-info-card__head">
        {renderIcon(icon, 'eq-fantasy-info-card__icon')}
        <div>
          {title ? <h2>{title}</h2> : null}
          {value ? <strong>{value}</strong> : null}
        </div>
        {badges ? <div className="eq-fantasy-badge-row">{badges}</div> : null}
      </div>
      {children ? <div className="eq-fantasy-info-card__body">{children}</div> : null}
      {footer ? <div className="eq-fantasy-info-card__footer">{footer}</div> : null}
    </Component>
  );
}

export function EQBadge({
  as: Component = 'span',
  children,
  label,
  tone = '#ffd35a',
  className = '',
  style,
  ...props
}) {
  return (
    <Component
      className={cx('eq-fantasy-badge', className)}
      style={toneStyle(tone, style)}
      {...props}
    >
      {children ?? label}
    </Component>
  );
}

function EQButtonBase({
  as: Component = 'button',
  icon,
  children,
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}) {
  const buttonProps = Component === 'button' ? { type } : {};

  return (
    <Component
      className={cx(fullWidth && 'is-full-width', className)}
      {...buttonProps}
      {...props}
    >
      {renderIcon(icon, 'eq-fantasy-button__icon')}
      <span>{children}</span>
    </Component>
  );
}

export function EQPrimaryButton({ className = '', ...props }) {
  return (
    <EQButtonBase
      className={cx('eq-gold-button eq-fantasy-button eq-fantasy-primary-button', className)}
      {...props}
    />
  );
}

export function EQSecondaryButton({ className = '', ...props }) {
  return (
    <EQButtonBase
      className={cx('eq-fantasy-button eq-fantasy-secondary-button', className)}
      {...props}
    />
  );
}

const stateClassMap = {
  selected: 'is-selected',
  correct: 'is-correct',
  wrong: 'is-wrong',
};

export function EQChoiceButton({
  badge,
  label,
  children,
  selected = false,
  correct = false,
  wrong = false,
  state,
  feedback,
  className = '',
  type = 'button',
  ...props
}) {
  const visualState = stateClassMap[state] || '';
  const isSelected = selected || state === 'selected';
  const classes = cx(
    'eq-choice-button',
    'eq-fantasy-choice-button',
    isSelected && 'is-selected',
    correct && 'is-correct',
    wrong && 'is-wrong',
    visualState,
    className,
  );

  return (
    <button
      type={type}
      className={classes}
      aria-selected={isSelected ? 'true' : undefined}
      {...props}
    >
      {badge ? <span className="eq-choice-badge">{badge}</span> : null}
      <span className="eq-choice-text">{children ?? label}</span>
      {feedback ? <span className="eq-fantasy-choice-button__feedback">{feedback}</span> : null}
    </button>
  );
}
