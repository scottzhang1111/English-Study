export function normalizeTargetLevel(value, defaultValue = 'eiken3') {
  const raw = String(value || '').trim();
  if (!raw) return defaultValue;

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    eiken3: 'eiken3',
    eiken_3: 'eiken3',
    '3級': 'eiken3',
    '３級': 'eiken3',
    '三級': 'eiken3',
    '英検3級': 'eiken3',
    '英検３級': 'eiken3',
    '英検三級': 'eiken3',
    eiken_pre2: 'eiken_pre2',
    eiken_pre_2: 'eiken_pre2',
    pre2: 'eiken_pre2',
    '準2級': 'eiken_pre2',
    '準２級': 'eiken_pre2',
    '準二級': 'eiken_pre2',
    '英検準2級': 'eiken_pre2',
    '英検準２級': 'eiken_pre2',
    '英検準二級': 'eiken_pre2',
  };

  return aliases[normalized] || defaultValue;
}

export function getTargetLevelLabel(value) {
  const normalized = normalizeTargetLevel(value);
  if (normalized === 'eiken_pre2') return '英検準2級';
  if (normalized === 'eiken3') return '英検3級';
  return '—';
}

export function getTargetLevelGoalLabel(value) {
  const label = getTargetLevelLabel(value);
  return label === '—' ? label : `${label}をめざす`;
}
