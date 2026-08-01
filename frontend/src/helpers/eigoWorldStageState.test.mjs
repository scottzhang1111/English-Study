import assert from 'node:assert/strict';

import { EIGO_BOSS_TYPES, getEigoBossById } from '../data/eigoBosses.js';
import {
  getBossNodeState,
  getStageNodeState,
  isMiniBoss2GateSatisfied,
} from './eigoWorldStageState.js';

function makeWorldProgress(clearedStages = [], statusOverrides = {}) {
  const cleared = new Set(clearedStages);
  return {
    id: 'wind',
    stages: Array.from({ length: 10 }, (_, index) => {
      const stage = index + 1;
      const status = statusOverrides[stage] || (cleared.has(stage) ? 'cleared' : 'locked');
      return {
        stage,
        status,
        cleared: cleared.has(stage),
        unlocked: cleared.has(stage) || status === 'current' || status === 'in_progress',
      };
    }),
  };
}

const miniBoss2 = getEigoBossById('wind-stage-8-mini-boss-2');
assert.equal(miniBoss2?.bossType, EIGO_BOSS_TYPES.MINI_BOSS);
assert.equal(miniBoss2?.checkpointAfterStage, 8);

{
  const worldProgress = makeWorldProgress([1, 2, 3, 4, 5, 6, 7]);
  assert.equal(isMiniBoss2GateSatisfied(worldProgress, 'wind'), false);
  assert.equal(getBossNodeState(worldProgress, 'wind', miniBoss2), 'locked');
}

{
  const worldProgress = makeWorldProgress([1, 2, 3, 4, 5, 6, 7, 8], { 9: 'current' });
  assert.equal(isMiniBoss2GateSatisfied(worldProgress, 'wind'), true);
  assert.equal(getBossNodeState(worldProgress, 'wind', miniBoss2), 'available');
  assert.equal(getStageNodeState(worldProgress, 'wind', 9), 'locked');
}

{
  const worldProgress = makeWorldProgress([1, 2, 3, 4, 5, 6, 7, 8]);
  const bossProgressMap = {
    'wind-stage-8-mini-boss-2': { cleared: true },
  };
  assert.equal(getBossNodeState(worldProgress, 'wind', miniBoss2, bossProgressMap), 'cleared');
  assert.equal(getStageNodeState(worldProgress, 'wind', 9, bossProgressMap), 'available');
}

console.log('eigoWorldStageState Mini Boss 2 tests passed');
