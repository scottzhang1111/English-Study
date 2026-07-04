import { getEigoBossById } from '../data/eigoBosses';
import { isBossCleared as isBossClearedFromStorage } from './eigoBossProgress';

function normalizeStageStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['cleared', 'completed', 'clear'].includes(normalized)) return 'cleared';
  if (['in_progress', 'current', 'available'].includes(normalized)) return 'in_progress';
  return '';
}

function getStageProgressRecord(worldProgress, stageNumber) {
  if (!worldProgress?.stages) return null;
  return worldProgress.stages.find((item) => Number(item.stage) === Number(stageNumber)) || null;
}

export function hasStageCleared(worldProgress, worldId, stageNumber) {
  const record = getStageProgressRecord(worldProgress, stageNumber);
  return normalizeStageStatus(record?.status) === 'cleared';
}

export function hasStageInProgress(worldProgress, worldId, stageNumber) {
  const record = getStageProgressRecord(worldProgress, stageNumber);
  return normalizeStageStatus(record?.status) === 'in_progress';
}

export function hasReachedStage(worldProgress, worldId, stageNumber) {
  const target = Number(stageNumber || 0);
  if (!target) return false;
  for (let stage = target; stage <= 10; stage += 1) {
    if (hasStageCleared(worldProgress, worldId, stage) || hasStageInProgress(worldProgress, worldId, stage)) {
      return true;
    }
  }
  return false;
}

export function isBossCleared(bossId) {
  return isBossClearedFromStorage(bossId);
}

export function isMiniBoss1GateSatisfied(worldProgress, worldId) {
  const boss = getEigoBossById(`${worldId}-stage-4-mini-boss-1`);
  if (isBossCleared(boss?.bossId)) return true;
  return hasReachedStage(worldProgress, worldId, 5);
}

export function isMiniBoss2GateSatisfied(worldProgress, worldId) {
  const boss = getEigoBossById(`${worldId}-stage-8-mini-boss-2`);
  if (isBossCleared(boss?.bossId)) return true;
  return hasReachedStage(worldProgress, worldId, 9);
}

export function isWorldBossAvailable(worldProgress, worldId) {
  return hasStageCleared(worldProgress, worldId, 10);
}

export function getStageNodeState(worldProgress, worldId, stageNumber) {
  if (hasStageCleared(worldProgress, worldId, stageNumber)) return 'cleared';
  if (hasStageInProgress(worldProgress, worldId, stageNumber)) return 'in_progress';

  const stage = Number(stageNumber || 0);
  if (stage === 1) return 'available';
  if (stage === 2) return hasStageCleared(worldProgress, worldId, 1) ? 'available' : 'locked';
  if (stage === 3) return hasStageCleared(worldProgress, worldId, 2) ? 'available' : 'locked';
  if (stage === 4) return hasStageCleared(worldProgress, worldId, 3) ? 'available' : 'locked';
  if (stage === 5) return isMiniBoss1GateSatisfied(worldProgress, worldId) ? 'available' : 'locked';
  if (stage === 6) return hasStageCleared(worldProgress, worldId, 5) ? 'available' : 'locked';
  if (stage === 7) return hasStageCleared(worldProgress, worldId, 6) ? 'available' : 'locked';
  if (stage === 8) return hasStageCleared(worldProgress, worldId, 7) ? 'available' : 'locked';
  if (stage === 9) return isMiniBoss2GateSatisfied(worldProgress, worldId) ? 'available' : 'locked';
  if (stage === 10) return hasStageCleared(worldProgress, worldId, 9) ? 'available' : 'locked';

  return 'locked';
}

export function getBossNodeState(worldProgress, worldId, bossConfig) {
  if (!bossConfig) return 'locked';
  if (isBossCleared(bossConfig.bossId)) return 'cleared';

  const checkpointAfterStage = Number(bossConfig.checkpointAfterStage || 0);
  if (bossConfig.bossType === 'mini_boss' && checkpointAfterStage === 4) {
    return isMiniBoss1GateSatisfied(worldProgress, worldId) ? 'available' : 'locked';
  }
  if (bossConfig.bossType === 'mini_boss' && checkpointAfterStage === 8) {
    return isMiniBoss2GateSatisfied(worldProgress, worldId) ? 'available' : 'locked';
  }
  if (bossConfig.bossType === 'world_boss') {
    return isWorldBossAvailable(worldProgress, worldId) ? 'available' : 'locked';
  }

  return 'locked';
}
