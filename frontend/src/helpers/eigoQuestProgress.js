import eigoQuestWorlds, {
  EIGO_QUEST_TOTAL_STAGES,
  EIGO_QUEST_TOTAL_WORDS,
  EIGO_QUEST_WORDS_PER_STAGE,
} from '../config/eigoQuestWorlds';

export { EIGO_QUEST_TOTAL_STAGES, EIGO_QUEST_TOTAL_WORDS, EIGO_QUEST_WORDS_PER_STAGE };

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function normalizeWorlds(worlds = eigoQuestWorlds) {
  const sourceWorlds = Array.isArray(worlds) && worlds.length ? worlds : eigoQuestWorlds;
  return sourceWorlds.map((world, index) => ({
    ...world,
    order: world.order || index + 1,
    stageCount: Number(world.stageCount || world.stages || 10),
    wordCount: Number(world.wordCount || Number(world.stageCount || world.stages || 10) * EIGO_QUEST_WORDS_PER_STAGE),
    wordStartIndex: Number.isFinite(Number(world.wordStartIndex))
      ? Number(world.wordStartIndex)
      : sourceWorlds.slice(0, index).reduce((total, item) => (
        total + Number(item.wordCount || Number(item.stageCount || item.stages || 10) * EIGO_QUEST_WORDS_PER_STAGE)
      ), 0),
  }));
}

function getWorldForLearnedWords(learnedWords, worlds) {
  if (learnedWords >= EIGO_QUEST_TOTAL_WORDS) {
    return { world: worlds[worlds.length - 1], worldIndex: worlds.length - 1 };
  }

  const worldIndex = worlds.findIndex((world) => (
    learnedWords >= world.wordStartIndex && learnedWords < world.wordStartIndex + world.wordCount
  ));
  const safeWorldIndex = worldIndex >= 0 ? worldIndex : 0;
  return { world: worlds[safeWorldIndex], worldIndex: safeWorldIndex };
}

export function getEigoQuestProgress(learnedWordsCount = 0, worlds = eigoQuestWorlds) {
  const safeWorlds = normalizeWorlds(worlds);
  const learnedWords = clampNumber(learnedWordsCount, 0, EIGO_QUEST_TOTAL_WORDS);
  const { world: currentWorld, worldIndex } = getWorldForLearnedWords(learnedWords, safeWorlds);
  const worldStartWord = currentWorld.wordStartIndex;
  const wordsInWorld = Math.min(currentWorld.wordCount, Math.max(0, learnedWords - worldStartWord));
  const isComplete = learnedWords >= EIGO_QUEST_TOTAL_WORDS;
  const rawStageInWorld = Math.floor(wordsInWorld / EIGO_QUEST_WORDS_PER_STAGE) + 1;
  const stageInWorld = isComplete
    ? currentWorld.stageCount
    : clampNumber(rawStageInWorld, 1, currentWorld.stageCount);
  const stageIndex = safeWorlds.slice(0, worldIndex).reduce((total, world) => total + world.stageCount, 0) + stageInWorld - 1;
  const stageStartWord = worldStartWord + (stageInWorld - 1) * EIGO_QUEST_WORDS_PER_STAGE;
  const stageEndWord = Math.min(stageStartWord + EIGO_QUEST_WORDS_PER_STAGE, worldStartWord + currentWorld.wordCount);
  const stageWordTarget = Math.max(1, stageEndWord - stageStartWord);
  const stageWordsLearned = isComplete
    ? stageWordTarget
    : Math.max(0, learnedWords - stageStartWord);
  const stageProgressPercent = Math.min(100, Math.round((stageWordsLearned / stageWordTarget) * 100));
  const totalProgressPercent = Math.min(100, Math.round((learnedWords / EIGO_QUEST_TOTAL_WORDS) * 100));

  return {
    learnedWords,
    totalWords: EIGO_QUEST_TOTAL_WORDS,
    totalStages: EIGO_QUEST_TOTAL_STAGES,
    wordsPerStage: EIGO_QUEST_WORDS_PER_STAGE,
    worldIndex,
    stageIndex,
    stageInWorld,
    stageLabel: `Stage ${stageInWorld} / ${currentWorld.stageCount}`,
    stageStartWord,
    stageEndWord,
    stageWordTarget,
    stageWordsLearned: Math.min(stageWordsLearned, stageWordTarget),
    worldStartWord,
    worldWordsLearned: wordsInWorld,
    worldWordTarget: currentWorld.wordCount,
    worldStageCount: currentWorld.stageCount,
    stageProgressPercent,
    totalProgressPercent,
    currentWorld,
    isComplete,
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
  const safeWorlds = normalizeWorlds(worlds);

  return safeWorlds.map((world, index) => {
    const progressWords = clampNumber(learnedWordsCount - world.wordStartIndex, 0, world.wordCount);
    const isComplete = progressWords >= world.wordCount || progress.isComplete;
    const isCurrent = index === progress.worldIndex && !progress.isComplete;
    const completedStages = isComplete
      ? world.stageCount
      : isCurrent
        ? Math.max(0, progress.stageInWorld - 1)
        : 0;

    return {
      ...world,
      isComplete,
      isCurrent,
      completedStages,
      stageCount: world.stageCount,
      progressWords,
      progressPercent: isComplete
        ? 100
        : isCurrent
          ? Math.round(((completedStages + progress.stageProgressPercent / 100) / world.stageCount) * 100)
          : 0,
    };
  });
}
