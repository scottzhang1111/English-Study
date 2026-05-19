import eigoQuestWorlds from '../config/eigoQuestWorlds';

export const EIGO_QUEST_TOTAL_WORDS = 1500;
export const EIGO_QUEST_STAGES_PER_WORLD = 10;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function getEigoQuestProgress(learnedWordsCount = 0, worlds = eigoQuestWorlds) {
  const safeWorlds = Array.isArray(worlds) && worlds.length ? worlds : eigoQuestWorlds;
  const totalStages = safeWorlds.length * EIGO_QUEST_STAGES_PER_WORLD;
  const learnedWords = clampNumber(learnedWordsCount, 0, EIGO_QUEST_TOTAL_WORDS);
  const wordsPerStage = EIGO_QUEST_TOTAL_WORDS / totalStages;
  const rawStageIndex = Math.floor(learnedWords / wordsPerStage);
  const stageIndex = Math.min(totalStages - 1, rawStageIndex);
  const worldIndex = Math.floor(stageIndex / EIGO_QUEST_STAGES_PER_WORLD);
  const stageInWorld = (stageIndex % EIGO_QUEST_STAGES_PER_WORLD) + 1;
  const stageStartWord = Math.floor(stageIndex * wordsPerStage);
  const stageEndWord = stageIndex === totalStages - 1
    ? EIGO_QUEST_TOTAL_WORDS
    : Math.floor((stageIndex + 1) * wordsPerStage);
  const stageWordTarget = Math.max(1, stageEndWord - stageStartWord);
  const stageWordsLearned = Math.max(0, learnedWords - stageStartWord);
  const stageProgressPercent = Math.min(100, Math.round((stageWordsLearned / stageWordTarget) * 100));
  const totalProgressPercent = Math.min(100, Math.round((learnedWords / EIGO_QUEST_TOTAL_WORDS) * 100));
  const currentWorld = safeWorlds[worldIndex] || safeWorlds[0];

  return {
    learnedWords,
    totalWords: EIGO_QUEST_TOTAL_WORDS,
    totalStages,
    wordsPerStage,
    worldIndex,
    stageIndex,
    stageInWorld,
    stageLabel: `Stage ${stageInWorld} / ${EIGO_QUEST_STAGES_PER_WORLD}`,
    stageStartWord,
    stageEndWord,
    stageWordTarget,
    stageWordsLearned: Math.min(stageWordsLearned, stageWordTarget),
    stageProgressPercent,
    totalProgressPercent,
    currentWorld,
    isComplete: learnedWords >= EIGO_QUEST_TOTAL_WORDS,
  };
}

export function getWorldStageByLearnedWords(learnedWordsCount = 0, worlds = eigoQuestWorlds) {
  const progress = getEigoQuestProgress(learnedWordsCount, worlds);
  return {
    world: progress.currentWorld,
    worldIndex: progress.worldIndex,
    stage: progress.stageInWorld,
    stageLabel: progress.stageLabel,
    stageProgressPercent: progress.stageProgressPercent,
  };
}

export function getEigoQuestWorldsWithProgress(learnedWordsCount = 0, worlds = eigoQuestWorlds) {
  const progress = getEigoQuestProgress(learnedWordsCount, worlds);

  return worlds.map((world, index) => {
    const worldStartStage = index * EIGO_QUEST_STAGES_PER_WORLD;
    const worldEndStage = worldStartStage + EIGO_QUEST_STAGES_PER_WORLD - 1;
    const isComplete = progress.stageIndex > worldEndStage || progress.isComplete;
    const isCurrent = index === progress.worldIndex && !progress.isComplete;
    const completedStages = isComplete
      ? EIGO_QUEST_STAGES_PER_WORLD
      : isCurrent
        ? progress.stageInWorld - 1
        : 0;

    return {
      ...world,
      isComplete,
      isCurrent,
      completedStages,
      stageCount: EIGO_QUEST_STAGES_PER_WORLD,
      progressPercent: isComplete
        ? 100
        : isCurrent
          ? Math.round(((completedStages + progress.stageProgressPercent / 100) / EIGO_QUEST_STAGES_PER_WORLD) * 100)
          : 0,
    };
  });
}
