const stateClassMap = {
  selected: 'is-selected',
  correct: 'is-correct',
  wrong: 'is-wrong',
};

export default function EQChoiceButton({
  badge,
  label,
  children,
  selected = false,
  correct = false,
  wrong = false,
  state,
  className = '',
  type = 'button',
  ...props
}) {
  const visualState = stateClassMap[state] || '';
  const classes = [
    'eq-choice-button',
    selected ? 'is-selected' : '',
    correct ? 'is-correct' : '',
    wrong ? 'is-wrong' : '',
    visualState,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      aria-selected={selected || state === 'selected' ? 'true' : undefined}
      {...props}
    >
      {badge ? <span className="eq-choice-badge">{badge}</span> : null}
      <span className="eq-choice-text">{children || label}</span>
    </button>
  );
}
