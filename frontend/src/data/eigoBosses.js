export const EIGO_BOSS_TYPES = {
  MINI_BOSS: 'mini_boss',
  WORLD_BOSS: 'world_boss',
};

export const EIGO_BOSS_WORLDS = {
  WIND: 'wind',
  FIRE: 'fire',
  WATER: 'water',
  THUNDER: 'thunder',
  FOREST: 'forest',
  ROCK: 'rock',
  SHADOW: 'shadow',
  LIGHT: 'light',
};

export const DEFAULT_EIGO_BOSS_ID = 'wind-stage-4-mini-boss-1';

export const EIGO_BOSS_ID_ALIASES = {
  'wind-stage-4-harpy': DEFAULT_EIGO_BOSS_ID,
  'wind-mini-boss-1': DEFAULT_EIGO_BOSS_ID,
  'wind-mini-boss-2': 'wind-stage-8-mini-boss-2',
  'wind-world-boss': 'wind-stage-10-world-boss',
};

export const EIGO_BOSS_HERO_RULE_TYPES = {
  STAGE_CLUSTER: 'stage_cluster',
  RANDOM_WORLD: 'random_world',
};

const WIND_ELEMENT = {
  id: EIGO_BOSS_WORLDS.WIND,
  labelJa: '風',
  labelEn: 'Wind',
  color: 'cyan',
};

const MINI_BOSS_GATE_MESSAGE = 'Mini Bossをクリアすると次のStageが開くよ！';

export const EIGO_BOSSES = [
  {
    bossId: DEFAULT_EIGO_BOSS_ID,
    worldId: EIGO_BOSS_WORLDS.WIND,
    worldNameJa: '風の世界',
    stageId: 4,
    checkpointAfterStage: 4,
    bossType: EIGO_BOSS_TYPES.MINI_BOSS,

    nameJa: '風裂きハーピィ',
    nameEn: 'Storm Harpy',

    hp: 400,
    playerHp: 100,
    questionCount: 20,

    image: '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',
    cardImage: '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',

    element: WIND_ELEMENT,

    unlockCondition: {
      requiredClearedStages: [1, 2, 3, 4],
    },

    reviewRule: {
      sourceStages: [1, 2, 3, 4],
      questionMix: {
        stageWords: 0.7,
        mistakes: 0.2,
        importantWords: 0.1,
      },
      descriptionJa: '風の世界 Stage 1〜4 の総復習',
    },

    progressGate: {
      gateType: 'stage_progress',
      unlocksStagesFrom: 5,
      messageJa: MINI_BOSS_GATE_MESSAGE,
    },

    heroRule: {
      type: EIGO_BOSS_HERO_RULE_TYPES.STAGE_CLUSTER,
      sourceStages: [1, 2, 3, 4],
      count: 4,
      fallbackWorldId: EIGO_BOSS_WORLDS.WIND,
    },

    reward: {
      type: 'boss_card',
      rewardType: 'boss_card',
      cardId: 'boss-card-wind-mini-boss-1',
      nameJa: '風裂きハーピィカード',
      rarity: 'rare',
      image: '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',
      source: 'wind_stage_4_mini_boss_clear',
    },
  },
  {
    bossId: 'wind-stage-8-mini-boss-2',
    worldId: EIGO_BOSS_WORLDS.WIND,
    worldNameJa: '風の世界',
    stageId: 8,
    checkpointAfterStage: 8,
    bossType: EIGO_BOSS_TYPES.MINI_BOSS,

    nameJa: '嵐怨エリニュス',
    nameEn: 'Storm Erinys',

    hp: 400,
    playerHp: 100,
    questionCount: 20,

    image: '/assets/eigo-quest/cards/boss/wind-mini-boss2.png',
    cardImage: '/assets/eigo-quest/cards/boss/wind-mini-boss2.png',

    element: WIND_ELEMENT,

    unlockCondition: {
      requiredClearedStages: [5, 6, 7, 8],
    },

    reviewRule: {
      sourceStages: [5, 6, 7, 8],
      reviewStages: [1, 2, 3, 4],
      questionMix: {
        stageWords: 0.6,
        earlierReview: 0.25,
        mistakes: 0.15,
      },
      descriptionJa: '風の世界 Stage 5〜8 と Stage 1〜4 の復習',
    },

    progressGate: {
      gateType: 'stage_progress',
      unlocksStagesFrom: 9,
      messageJa: MINI_BOSS_GATE_MESSAGE,
    },

    heroRule: {
      type: EIGO_BOSS_HERO_RULE_TYPES.STAGE_CLUSTER,
      sourceStages: [5, 6, 7, 8],
      count: 4,
      fallbackWorldId: EIGO_BOSS_WORLDS.WIND,
    },

    reward: {
      type: 'boss_card',
      rewardType: 'boss_card',
      cardId: 'boss-card-wind-mini-boss-2',
      nameJa: '嵐怨エリニュスカード',
      rarity: 'rare',
      image: '/assets/eigo-quest/cards/boss/wind-mini-boss2.png',
      source: 'wind_stage_8_mini_boss_clear',
    },
  },
  {
    bossId: 'wind-stage-10-world-boss',
    worldId: EIGO_BOSS_WORLDS.WIND,
    worldNameJa: '風の世界',
    stageId: 10,
    checkpointAfterStage: 10,
    bossType: EIGO_BOSS_TYPES.WORLD_BOSS,

    nameJa: '風の世界ボス',
    nameEn: 'Wind World Boss',

    hp: 600,
    playerHp: 100,
    questionCount: 30,

    image: '/assets/eigo-quest/cards/boss/wind-world-boss.png',
    cardImage: '/assets/eigo-quest/cards/boss/wind-world-boss.png',

    element: WIND_ELEMENT,

    unlockCondition: {
      requiredClearedStages: [9, 10],
    },

    reviewRule: {
      sourceStages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      questionMix: {
        stageWords: 0.5,
        mistakes: 0.3,
        importantWords: 0.2,
      },
      descriptionJa: '風の世界 Stage 1〜10 の総復習',
    },

    progressGate: {
      gateType: 'world_progress',
      unlocksNextWorld: true,
      messageJa: 'World Bossをクリアすると次の世界が開くよ！',
    },

    heroRule: {
      type: EIGO_BOSS_HERO_RULE_TYPES.RANDOM_WORLD,
      worldId: EIGO_BOSS_WORLDS.WIND,
      count: 4,
    },

    reward: {
      type: 'boss_card',
      rewardType: 'boss_card',
      cardId: 'boss-card-wind-world-boss',
      nameJa: '風の世界ボスカード',
      rarity: 'super_rare',
      image: '/assets/eigo-quest/cards/boss/wind-world-boss.png',
      source: 'wind_stage_10_world_boss_clear',
    },
  },
];

export function normalizeEigoBossId(bossId) {
  return EIGO_BOSS_ID_ALIASES[bossId] || bossId;
}

export function getEigoBossById(bossId) {
  const normalizedBossId = normalizeEigoBossId(bossId || DEFAULT_EIGO_BOSS_ID);
  return EIGO_BOSSES.find((boss) => boss.bossId === normalizedBossId) || null;
}

export function getEigoBossesByWorld(worldId) {
  return EIGO_BOSSES.filter((boss) => boss.worldId === worldId);
}

export function getEigoBossesAfterStage(worldId, stageId) {
  return getEigoBossesByWorld(worldId).filter(
    (boss) => Number(boss.checkpointAfterStage) === Number(stageId)
  );
}

export function getEigoBossBattleRoute(bossId) {
  return `/boss-battle-v1?bossId=${encodeURIComponent(normalizeEigoBossId(bossId))}`;
}
