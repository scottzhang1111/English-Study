import { useEffect, useMemo, useRef, useState } from 'react';
import EQBottomNav from './EQBottomNav';
import { EQ_ASSETS } from './EQAssetMap';
import './EQFantasyPrimitives.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function renderIcon(icon, className) {
  if (!icon) return null;
  return (
    <span className={className} aria-hidden="true">
      {icon}
    </span>
  );
}

function normalizeOption(option) {
  if (typeof option === 'string') {
    return { value: option, label: option };
  }
  return {
    value: option?.value ?? option?.id ?? option?.label ?? '',
    label: option?.label ?? option?.value ?? option?.id ?? '',
    description: option?.description,
    disabled: Boolean(option?.disabled),
  };
}

export function EQPageShell({
  children,
  className = '',
  contentClassName = '',
  withBottomNav = false,
  bottomNavClassName = '',
  maxWidth = '980px',
  ...props
}) {
  return (
    <>
      <main className={cx('eq-fantasy-page-shell', className)} {...props}>
        <div className={cx('eq-fantasy-page-shell__content', contentClassName)} style={{ '--eq-page-shell-max-width': maxWidth }}>
          {children}
        </div>
      </main>
      {withBottomNav ? <EQBottomNav className={bottomNavClassName} /> : null}
    </>
  );
}

export function EQHeroHeader({
  eyebrow,
  title,
  subtitle,
  bgImage,
  backgroundImage,
  fairyImage,
  helperImage,
  emblemImage,
  elementLabel,
  progressText,
  badges,
  className = '',
  children,
  ...props
}) {
  return (
    <section
      className={cx('eq-fantasy-hero-header', className)}
      style={{
        '--eq-hero-bg': (bgImage || backgroundImage) ? `url("${bgImage || backgroundImage}")` : undefined,
      }}
      {...props}
    >
      {emblemImage ? <img className="eq-fantasy-hero-header__emblem" src={emblemImage} alt="" /> : null}
      <div className="eq-fantasy-hero-header__copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        {title ? <h1>{title}</h1> : null}
        {subtitle ? <p>{subtitle}</p> : null}
        {(elementLabel || progressText || badges?.length) ? (
          <div className="eq-fantasy-hero-header__meta">
            {elementLabel ? <EQFantasyBadge>{elementLabel}</EQFantasyBadge> : null}
            {progressText ? <EQFantasyBadge>{progressText}</EQFantasyBadge> : null}
            {badges?.map((badge) => (
              <EQFantasyBadge key={String(badge)}>{badge}</EQFantasyBadge>
            ))}
          </div>
        ) : null}
        {children}
      </div>
      {fairyImage || helperImage ? (
        <img className="eq-fantasy-hero-header__helper" src={fairyImage || helperImage} alt="" />
      ) : null}
    </section>
  );
}

export function EQFantasyCard({
  as: Component = 'section',
  eyebrow,
  title,
  subtitle,
  icon,
  iconImage,
  cornerDecoration,
  actions,
  footer,
  children,
  className = '',
  glow = true,
  ...props
}) {
  return (
    <Component className={cx('eq-fantasy-card-v2', glow && 'has-glow', className)} {...props}>
      {cornerDecoration ? (
        <img className="eq-fantasy-card-v2__corner" src={cornerDecoration} alt="" />
      ) : null}
      {(eyebrow || title || subtitle || icon || iconImage || actions) ? (
        <div className="eq-fantasy-card-v2__head">
          {iconImage ? (
            <span className="eq-fantasy-card-v2__icon is-image" aria-hidden="true">
              <img src={iconImage} alt="" />
            </span>
          ) : renderIcon(icon, 'eq-fantasy-card-v2__icon')}
          <div className="eq-fantasy-card-v2__copy">
            {eyebrow ? <span>{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="eq-fantasy-card-v2__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className="eq-fantasy-card-v2__body">{children}</div> : null}
      {footer ? <div className="eq-fantasy-card-v2__footer">{footer}</div> : null}
    </Component>
  );
}

export function EQFantasyButton({
  as: Component = 'button',
  children,
  icon,
  iconImage,
  trailingIcon = '›',
  backgroundImage,
  variant = 'gold',
  fullWidth = false,
  className = '',
  style,
  type = 'button',
  ...props
}) {
  const buttonProps = Component === 'button' ? { type } : {};

  return (
    <Component
      className={cx(
        'eq-fantasy-button-v2',
        `is-${variant}`,
        fullWidth && 'is-full-width',
        className,
      )}
      style={{
        '--eq-fantasy-button-bg-image': backgroundImage
          ? `url("${backgroundImage}")`
          : undefined,
        ...style,
      }}
      {...buttonProps}
      {...props}
    >
      {iconImage ? (
        <span className="eq-fantasy-button-v2__icon is-image" aria-hidden="true">
          <img src={iconImage} alt="" />
        </span>
      ) : renderIcon(icon, 'eq-fantasy-button-v2__icon')}
      <span>{children}</span>
      {trailingIcon ? renderIcon(trailingIcon, 'eq-fantasy-button-v2__trail') : null}
    </Component>
  );
}

export function EQFantasyBadge({
  as: Component = 'span',
  children,
  icon,
  iconImage,
  variant = 'gold',
  className = '',
  ...props
}) {
  return (
    <Component className={cx('eq-fantasy-badge-v2', `is-${variant}`, className)} {...props}>
      {iconImage ? (
        <img className="eq-fantasy-badge-v2__image" src={iconImage} alt="" />
      ) : renderIcon(icon, 'eq-fantasy-badge-v2__icon')}
      <span>{children}</span>
    </Component>
  );
}

export function EQFantasyDropdown({
  label,
  value,
  defaultValue,
  options = [],
  onChange,
  placeholder = 'Select',
  className = '',
  disabled = false,
  menuLabel,
}) {
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const firstValue = normalizedOptions[0]?.value || '';
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstValue);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const currentValue = isControlled ? value : internalValue;
  const selected = normalizedOptions.find((option) => String(option.value) === String(currentValue));

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function selectOption(option) {
    if (option.disabled) return;
    if (!isControlled) setInternalValue(option.value);
    onChange?.(option.value, option);
    setIsOpen(false);
  }

  return (
    <label className={cx('eq-fantasy-dropdown', isOpen && 'is-open', disabled && 'is-disabled', className)} ref={rootRef}>
      {label ? <span className="eq-fantasy-dropdown__label">{label}</span> : null}
      <button
        type="button"
        className="eq-fantasy-dropdown__trigger"
        onClick={() => {
          if (!disabled) setIsOpen((current) => !current);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span>{selected?.label || placeholder}</span>
        <i aria-hidden="true">{isOpen ? '⌃' : '⌄'}</i>
      </button>
      {isOpen ? (
        <div className="eq-fantasy-dropdown__menu" role="listbox" aria-label={menuLabel || label}>
          {normalizedOptions.map((option) => {
            const optionSelected = String(option.value) === String(currentValue);
            return (
              <button
                key={String(option.value)}
                type="button"
                className={cx(optionSelected && 'is-selected')}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={optionSelected}
                disabled={option.disabled}
              >
                <span aria-hidden="true">{optionSelected ? '✓' : ''}</span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </label>
  );
}
