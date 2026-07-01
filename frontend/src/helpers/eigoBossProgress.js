export const EIGO_BOSS_CLEAR_STATUS_KEY = 'eigo_boss_clear_status';

export function getBossClearStatus() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EIGO_BOSS_CLEAR_STATUS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isBossCleared(bossId) {
  if (!bossId) return false;
  return Boolean(getBossClearStatus()[bossId]?.cleared);
}

export function markBossCleared(bossConfig) {
  if (!bossConfig?.bossId || typeof window === 'undefined') return null;

  // TODO: Replace this V1 localStorage mock with backend child_boss_progress.
  const nextStatus = {
    ...getBossClearStatus(),
    [bossConfig.bossId]: {
      bossId: bossConfig.bossId,
      worldId: bossConfig.worldId,
      stageId: bossConfig.stageId || bossConfig.checkpointAfterStage,
      checkpointAfterStage: bossConfig.checkpointAfterStage,
      bossType: bossConfig.bossType,
      cleared: true,
      clearedAt: Date.now(),
    },
  };

  try {
    window.localStorage.setItem(EIGO_BOSS_CLEAR_STATUS_KEY, JSON.stringify(nextStatus));
  } catch {
    return null;
  }

  return nextStatus[bossConfig.bossId];
}
