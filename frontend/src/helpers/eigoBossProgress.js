export const EIGO_BOSS_CLEAR_STATUS_KEY = 'eigo_boss_clear_status';
const EIGO_BOSS_MIGRATION_PREFIX = 'eigoBossProgressMigrated:';

function readBossClearStatus() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EIGO_BOSS_CLEAR_STATUS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getBossClearStatus(childId) {
  const parsed = readBossClearStatus();
  const scoped = childId ? parsed.byChild?.[String(childId)] : null;
  if (scoped && typeof scoped === 'object' && !Array.isArray(scoped)) return scoped;
  return parsed;
}

export function isBossCleared(bossId, childId) {
  if (!bossId) return false;
  return Boolean(getBossClearStatus(childId)[bossId]?.cleared);
}

export function markBossCleared(bossConfig, childId) {
  if (!bossConfig?.bossId || typeof window === 'undefined') return null;

  const currentStatus = readBossClearStatus();
  const childKey = childId ? String(childId) : '';
  const childStatus = childKey && currentStatus.byChild?.[childKey]
    ? currentStatus.byChild[childKey]
    : {};
  const entry = {
    bossId: bossConfig.bossId,
    worldId: bossConfig.worldId,
    stageId: bossConfig.stageId || bossConfig.checkpointAfterStage,
    checkpointAfterStage: bossConfig.checkpointAfterStage,
    bossType: bossConfig.bossType,
    cleared: true,
    clearedAt: Date.now(),
  };
  const nextStatus = {
    ...currentStatus,
    [bossConfig.bossId]: entry,
    byChild: {
      ...(currentStatus.byChild || {}),
      ...(childKey ? {
        [childKey]: {
          ...childStatus,
          [bossConfig.bossId]: entry,
        },
      } : {}),
    },
  };

  try {
    window.localStorage.setItem(EIGO_BOSS_CLEAR_STATUS_KEY, JSON.stringify(nextStatus));
  } catch {
    return null;
  }

  return entry;
}

export function isBossProgressMigrationMarked(childId) {
  if (!childId || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${EIGO_BOSS_MIGRATION_PREFIX}${childId}`) === 'true';
  } catch {
    return false;
  }
}

export function markBossProgressMigrated(childId) {
  if (!childId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${EIGO_BOSS_MIGRATION_PREFIX}${childId}`, 'true');
  } catch {
    // Keep migration non-blocking when storage is unavailable.
  }
}
