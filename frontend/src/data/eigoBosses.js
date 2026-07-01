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

export const DEFAULT_EIGO_BOSS_ID = 'wind-stage-4-harpy';

export const EIGO_BOSSES = [
  {
    bossId: DEFAULT_EIGO_BOSS_ID,
    worldId: EIGO_BOSS_WORLDS.WIND,
    worldNameJa: '風の世界',
    stageId: 4,
    bossType: EIGO_BOSS_TYPES.MINI_BOSS,

    nameJa: '風裂きハーピィ',
    nameEn: 'Storm Harpy',

    hp: 120,
    playerHp: 100,
    questionCount: 8,

    image: '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',
    cardImage: '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',

    element: {
      id: EIGO_BOSS_WORLDS.WIND,
      labelJa: '風',
      labelEn: 'Wind',
      color: 'cyan',
    },

    unlockRule: {
      requiredWorldId: EIGO_BOSS_WORLDS.WIND,
      requiredClearedStages: [1, 2, 3],
    },

    reviewRule: {
      sourceStages: [1, 2, 3],
      questionMix: {
        stageWords: 0.7,
        mistakes: 0.2,
        importantWords: 0.1,
      },
      descriptionJa: '風の世界 Stage 1〜3 の総復習',
    },

    progressGate: {
      blocksStagesAfter: 4,
      unlocksStagesFrom: 5,
      gateType: 'stage_progress',
      messageJa: 'Mini Bossをクリアすると次のStageが開くよ！',
    },

    reward: {
      type: 'boss_card',
      cardId: 'boss-card-wind-stage-4-harpy',
      nameJa: '風裂きハーピィカード',
      rarity: 'rare',
      image: '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',
      source: 'wind_stage_4_boss_clear',
    },
  },
  {
    bossId: 'wind-stage-8-griffin',
    worldId: EIGO_BOSS_WORLDS.WIND,
    worldNameJa: '風の世界',
    stageId: 8,
    bossType: EIGO_BOSS_TYPES.MINI_BOSS,

    nameJa: '旋風のグリフォン',
    nameEn: 'Gale Griffin',

    hp: 150,
    playerHp: 100,
    questionCount: 9,

    image: '/assets/eigo-quest/cards/boss/wind-mini-boss2.png',
    cardImage: '/assets/eigo-quest/cards/boss/wind-mini-boss2.png',

    element: {
      id: EIGO_BOSS_WORLDS.WIND,
      labelJa: '風',
      labelEn: 'Wind',
      color: 'cyan',
    },

    unlockRule: {
      requiredWorldId: EIGO_BOSS_WORLDS.WIND,
      requiredClearedStages: [5, 6, 7],
    },

    reviewRule: {
      sourceStages: [5, 6, 7],
      questionMix: {
        stageWords: 0.7,
        mistakes: 0.2,
        importantWords: 0.1,
      },
      descriptionJa: '風の世界 Stage 5〜7 の総復習',
    },

    progressGate: {
      blocksStagesAfter: 8,
      unlocksStagesFrom: 9,
      gateType: 'stage_progress',
      messageJa: 'Mini Bossをクリアすると次のStageが開くよ！',
    },

    reward: {
      type: 'boss_card',
      cardId: 'boss-card-wind-stage-8-griffin',
      nameJa: '旋風のグリフォンカード',
      rarity: 'rare',
      image: '/assets/eigo-quest/cards/boss/wind-mini-boss2.png',
      source: 'wind_stage_8_boss_clear',
    },
  },
  {
    bossId: 'wind-stage-10-tempest-dragon',
    worldId: EIGO_BOSS_WORLDS.WIND,
    worldNameJa: '風の世界',
    stageId: 10,
    bossType: EIGO_BOSS_TYPES.WORLD_BOSS,

    nameJa: '嵐王テンペストドラゴン',
    nameEn: 'Tempest Dragon',

    hp: 200,
    playerHp: 100,
    questionCount: 10,

    image: '/assets/eigo-quest/cards/boss/wind-world-boss.png',
    cardImage: '/assets/eigo-quest/cards/boss/wind-world-boss.png',

    element: {
      id: EIGO_BOSS_WORLDS.WIND,
      labelJa: '風',
      labelEn: 'Wind',
      color: 'cyan',
    },

    unlockRule: {
      requiredWorldId: EIGO_BOSS_WORLDS.WIND,
      requiredClearedStages: [9],
      requiredBossIds: ['wind-stage-8-griffin'],
    },

    reviewRule: {
      sourceStages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      questionMix: {
        stageWords: 0.65,
        mistakes: 0.25,
        importantWords: 0.1,
      },
      descriptionJa: '風の世界 Stage 1〜9 の総復習',
    },

    progressGate: {
      blocksStagesAfter: 10,
      unlocksNextWorld: true,
      gateType: 'world_progress',
      messageJa: 'World Bossをクリアすると次の世界が開くよ！',
    },

    reward: {
      type: 'boss_card',
      cardId: 'boss-card-wind-stage-10-tempest-dragon',
      nameJa: '嵐王テンペストドラゴンカード',
      rarity: 'legendary',
      image: '/assets/eigo-quest/cards/boss/wind-world-boss.png',
      source: 'wind_stage_10_boss_clear',
    },
  },
];

export function getEigoBossById(bossId) {
  return EIGO_BOSSES.find((boss) => boss.bossId === bossId) || null;
}

export function getEigoBossByWorldStage(worldId, stageId) {
  return EIGO_BOSSES.find(
    (boss) => boss.worldId === worldId && boss.stageId === Number(stageId)
  ) || null;
}

export function getEigoBossBattleRoute(bossId) {
  return `/boss-battle-v1?bossId=${encodeURIComponent(bossId)}`;
}
