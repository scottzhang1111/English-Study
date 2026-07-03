import './EQStageNode.css';

const STAGE_ASSET_BASE = '/assets/eigo-quest/stage';

const STAGE_NODE_ASSETS = {
  stage: {
    close: `${STAGE_ASSET_BASE}/stage-close.png`,
    open: `${STAGE_ASSET_BASE}/stage-open.png`,
    clear: `${STAGE_ASSET_BASE}/stage-clear.png`,
  },
  mini_boss: {
    close: `${STAGE_ASSET_BASE}/stage-miniboss-close.png`,
    open: `${STAGE_ASSET_BASE}/stage-miniboss-open.png`,
    clear: `${STAGE_ASSET_BASE}/stage-miniboss-clear.png`,
  },
  boss: {
    close: `${STAGE_ASSET_BASE}/stage-boss-close.png`,
    open: `${STAGE_ASSET_BASE}/stage-boss-open.png`,
    clear: `${STAGE_ASSET_BASE}/stage-boss-open.png`,
  },
};

function normalizeType(type) {
  if (type === 'mini_boss') return 'mini_boss';
  if (type === 'boss' || type === 'world_boss') return 'boss';
  return 'stage';
}

function normalizeState(state) {
  if (state === 'clear' || state === 'completed' || state === 'cleared') return 'clear';
  if (state === 'close' || state === 'locked') return 'close';
  return 'open';
}

function getMainText(type, number, label) {
  if (type === 'stage') return number;
  if (type === 'mini_boss') return number ? `M${number}` : 'M';
  return label === 'Boss' || label === 'World Boss' ? 'B' : (label || 'B');
}

export default function EQStageNode({
  type = 'stage',
  state = 'close',
  number,
  isCurrent = false,
  label = '',
  size = 'md',
  className = '',
  disabled = false,
  debugLabel = '',
  children,
  ...buttonProps
}) {
  const nodeType = normalizeType(type);
  const nodeState = normalizeState(state);
  const assetSrc = STAGE_NODE_ASSETS[nodeType][nodeState];
  const mainText = getMainText(nodeType, number, label);
  const showClear = nodeState === 'clear';
  const labelText = nodeType === 'stage' ? '' : label;

  return (
    <button
      type="button"
      className={[
        'eq-stage-node-v2',
        `is-${nodeType}`,
        `is-${nodeState}`,
        `is-${size}`,
        isCurrent ? 'is-current' : '',
        disabled ? 'is-disabled' : '',
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      {...buttonProps}
    >
      <img className="eq-stage-node-v2__image" src={assetSrc} alt="" aria-hidden="true" draggable="false" />
      <span className="eq-stage-node-v2__text">{mainText}</span>
      {labelText ? <span className="eq-stage-node-v2__label">{labelText}</span> : null}
      {isCurrent ? <span className="eq-stage-node-v2__current">現在</span> : null}
      {showClear ? <span className="eq-stage-node-v2__clear">CLEAR!</span> : null}
      {debugLabel ? <small className="eq-stage-node-debug-label">{debugLabel}</small> : null}
      {children}
    </button>
  );
}
