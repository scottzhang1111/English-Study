export const EIGO_BOSS_TYPES = {
  MINI_BOSS: 'mini_boss',
  WORLD_BOSS: 'world_boss',
};

export const EIGO_BOSS_WORLDS = {
  WIND: 'wind',
  FIRE: 'fire',
  WATER: 'water',
  THUNDER: 'thunder',
  FOREST: 'wood',
  WOOD: 'wood',
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

const BOSS_PLACEHOLDER_IMAGE = '/assets/eigo-quest/cards/boss/boss-placeholder.png';

const AVAILABLE_BOSS_IMAGE_PATHS = new Set([
  '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/wind-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/wind-world-boss.png',
  '/assets/eigo-quest/cards/boss/fire-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/fire-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/fire-world-boss.png',
  '/assets/eigo-quest/cards/boss/water-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/water-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/water-world-boss.png',
  '/assets/eigo-quest/cards/boss/thunder-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/thunder-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/thunder-world-boss.png',
  '/assets/eigo-quest/cards/boss/wood-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/wood-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/wood-world-boss.png',
  '/assets/eigo-quest/cards/boss/rock-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/rock-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/rock-world-boss.png',
  '/assets/eigo-quest/cards/boss/light-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/light-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/light-world-boss.png',
  '/assets/eigo-quest/cards/boss/shadow-mini-boss1.png',
  '/assets/eigo-quest/cards/boss/shadow-mini-boss2.png',
  '/assets/eigo-quest/cards/boss/shadow-world-boss.png',
]);

const MINI_BOSS_GATE_MESSAGE = 'Mini Bossをクリアすると次のStageが開くよ！';
const WORLD_BOSS_GATE_MESSAGE = 'World Bossをクリアすると次の世界が開くよ！';

const STANDARD_WORLD_DEFS = [
  { id: EIGO_BOSS_WORLDS.WIND, nameJa: '風の世界', nameEn: 'Wind', labelJa: '風', color: 'cyan' },
  { id: EIGO_BOSS_WORLDS.FIRE, nameJa: '火の世界', nameEn: 'Fire', labelJa: '火', color: 'red' },
  { id: EIGO_BOSS_WORLDS.WATER, nameJa: '水の世界', nameEn: 'Water', labelJa: '水', color: 'blue' },
  { id: EIGO_BOSS_WORLDS.THUNDER, nameJa: '雷の世界', nameEn: 'Thunder', labelJa: '雷', color: 'yellow' },
  { id: EIGO_BOSS_WORLDS.WOOD, nameJa: '森の世界', nameEn: 'Forest', labelJa: '森', color: 'green' },
  { id: EIGO_BOSS_WORLDS.ROCK, nameJa: '岩の世界', nameEn: 'Rock', labelJa: '岩', color: 'stone' },
  { id: EIGO_BOSS_WORLDS.LIGHT, nameJa: '光の世界', nameEn: 'Light', labelJa: '光', color: 'gold' },
];

const SHADOW_WORLD_DEF = {
  id: EIGO_BOSS_WORLDS.SHADOW,
  nameJa: '影の世界',
  nameEn: 'Shadow',
  labelJa: '影',
  color: 'purple',
};

function getBossImage(path) {
  return AVAILABLE_BOSS_IMAGE_PATHS.has(path) ? path : BOSS_PLACEHOLDER_IMAGE;
}

function createElement(world) {
  return {
    id: world.id,
    labelJa: world.labelJa,
    labelEn: world.nameEn,
    color: world.color,
  };
}

function createReward({ cardId, nameJa, rarity, image, source }) {
  return {
    type: 'boss_card',
    rewardType: 'boss_card',
    cardId,
    nameJa,
    rarity,
    image,
    source,
  };
}

function createMiniBoss1(world) {
  const bossId = `${world.id}-stage-4-mini-boss-1`;
  const image = getBossImage(`/assets/eigo-quest/cards/boss/${world.id}-mini-boss1.png`);
  const bossNameJa = world.id === 'wind' ? '風裂きハーピィ' : `${world.nameJa}ミニボス1`;

  return {
    bossId,
    worldId: world.id,
    worldNameJa: world.nameJa,
    stageId: 4,
    checkpointAfterStage: 4,
    bossType: EIGO_BOSS_TYPES.MINI_BOSS,
    nameJa: bossNameJa,
    nameEn: world.id === 'wind' ? 'Storm Harpy' : `${world.nameEn} Mini Boss 1`,
    hp: 400,
    playerHp: 100,
    questionCount: 20,
    image,
    cardImage: image,
    element: createElement(world),
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
      descriptionJa: `${world.nameJa} Stage 1〜4 の総復習`,
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
      fallbackWorldId: world.id,
    },
    reward: createReward({
      cardId: `boss-card-${world.id}-mini-boss-1`,
      nameJa: `${bossNameJa}カード`,
      rarity: 'rare',
      image,
      source: `${world.id}_stage_4_mini_boss_clear`,
    }),
  };
}

function createMiniBoss2(world) {
  const bossId = `${world.id}-stage-8-mini-boss-2`;
  const image = getBossImage(`/assets/eigo-quest/cards/boss/${world.id}-mini-boss2.png`);
  const bossNameJa = world.id === 'wind' ? '嵐怨エリニュス' : `${world.nameJa}ミニボス2`;

  return {
    bossId,
    worldId: world.id,
    worldNameJa: world.nameJa,
    stageId: 8,
    checkpointAfterStage: 8,
    bossType: EIGO_BOSS_TYPES.MINI_BOSS,
    nameJa: bossNameJa,
    nameEn: world.id === 'wind' ? 'Storm Erinys' : `${world.nameEn} Mini Boss 2`,
    hp: 400,
    playerHp: 100,
    questionCount: 20,
    image,
    cardImage: image,
    element: createElement(world),
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
      descriptionJa: `${world.nameJa} Stage 5〜8 と Stage 1〜4 の復習`,
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
      fallbackWorldId: world.id,
    },
    reward: createReward({
      cardId: `boss-card-${world.id}-mini-boss-2`,
      nameJa: `${bossNameJa}カード`,
      rarity: 'rare',
      image,
      source: `${world.id}_stage_8_mini_boss_clear`,
    }),
  };
}

function createWorldBoss(world, stageId = 10, sourceStages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const bossId = `${world.id}-stage-${stageId}-world-boss`;
  const image = getBossImage(`/assets/eigo-quest/cards/boss/${world.id}-world-boss.png`);
  const bossNameJa = `${world.nameJa}ボス`;

  return {
    bossId,
    worldId: world.id,
    worldNameJa: world.nameJa,
    stageId,
    checkpointAfterStage: stageId,
    bossType: EIGO_BOSS_TYPES.WORLD_BOSS,
    nameJa: bossNameJa,
    nameEn: `${world.nameEn} World Boss`,
    hp: 600,
    playerHp: 100,
    questionCount: 30,
    image,
    cardImage: image,
    element: createElement(world),
    unlockCondition: {
      requiredClearedStages: [stageId - 1, stageId].filter((stage) => stage > 0),
    },
    reviewRule: {
      sourceStages,
      questionMix: {
        stageWords: 0.5,
        mistakes: 0.3,
        importantWords: 0.2,
      },
      descriptionJa: `${world.nameJa} Stage 1〜${stageId} の総復習`,
    },
    progressGate: {
      gateType: 'world_progress',
      unlocksNextWorld: true,
      messageJa: WORLD_BOSS_GATE_MESSAGE,
    },
    heroRule: {
      type: EIGO_BOSS_HERO_RULE_TYPES.RANDOM_WORLD,
      worldId: world.id,
      count: 4,
    },
    reward: createReward({
      cardId: `boss-card-${world.id}-world-boss`,
      nameJa: `${bossNameJa}カード`,
      rarity: 'super_rare',
      image,
      source: `${world.id}_stage_${stageId}_world_boss_clear`,
    }),
  };
}

function createStandardWorldBosses(world) {
  return [
    createMiniBoss1(world),
    createMiniBoss2(world),
    createWorldBoss(world),
  ];
}

function createShadowBosses() {
  const miniBoss = createMiniBoss1(SHADOW_WORLD_DEF);
  const worldBoss = createWorldBoss(SHADOW_WORLD_DEF, 5, [1, 2, 3, 4, 5]);

  return [
    miniBoss,
    {
      ...worldBoss,
      unlockCondition: {
        requiredClearedStages: [5],
      },
      reviewRule: {
        ...worldBoss.reviewRule,
        descriptionJa: '影の世界 Stage 1〜5 の総復習',
      },
    },
  ];
}

export const EIGO_BOSSES = [
  ...STANDARD_WORLD_DEFS.flatMap(createStandardWorldBosses),
  ...createShadowBosses(),
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
