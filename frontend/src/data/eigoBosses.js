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

    reward: {
      type: 'boss_card',
      cardId: 'boss-card-wind-stage-4-harpy',
      nameJa: '風裂きハーピィカード',
      rarity: 'rare',
      image: '/assets/eigo-quest/cards/boss/wind-mini-boss1.png',
      source: 'wind_stage_4_boss_clear',
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
