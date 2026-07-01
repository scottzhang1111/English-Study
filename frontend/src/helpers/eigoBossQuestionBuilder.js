function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function normalizeWord(rawWord, fallbackStageId) {
  if (!rawWord || typeof rawWord !== 'object') return null;
  const word = String(rawWord.word || rawWord.english || rawWord.English || '').trim();
  const meaningJa = String(
    rawWord.meaningJa
    || rawWord.meaning_ja
    || rawWord.japanese
    || rawWord.meaning
    || ''
  ).trim();

  if (!word || !meaningJa) return null;

  return {
    ...rawWord,
    id: rawWord.id || rawWord.vocabId || rawWord.vocab_id || word,
    word,
    meaningJa,
    stageId: Number(
      rawWord.stageId
      || rawWord.stage_id
      || rawWord.stage
      || rawWord.stageNumber
      || rawWord.stage_number
      || fallbackStageId
      || 0
    ) || null,
  };
}

function uniqueByWord(words) {
  const seen = new Set();
  return words.filter((word) => {
    const key = word.word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueChoices(choices) {
  const seen = new Set();
  return choices.filter((choice) => {
    const key = String(choice || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeFallbackQuestion(question, index) {
  if (!question) return null;
  const choices = Array.isArray(question.choices) ? question.choices : [];
  const answerIndex = choices.findIndex((choice) => choice === question.answer);
  return {
    ...question,
    id: question.id || `fallback-boss-q-${index + 1}`,
    answerIndex: answerIndex >= 0 ? answerIndex : question.answerIndex,
    source: question.source || { type: 'fallback_mock' },
  };
}

function getTargetQuestionCount(bossConfig) {
  const configuredCount = Number(bossConfig?.questionCount);
  return Math.max(1, Number.isFinite(configuredCount) && configuredCount > 0 ? configuredCount : 20);
}

function buildFallbackQuestions(fallbackQuestions, targetCount, existingIds = new Set()) {
  const normalizedFallbacks = fallbackQuestions
    .map(normalizeFallbackQuestion)
    .filter(Boolean);

  if (!normalizedFallbacks.length || targetCount <= 0) return [];

  const picked = [];
  let repeatIndex = 0;

  while (picked.length < targetCount) {
    const sourceQuestion = normalizedFallbacks[repeatIndex % normalizedFallbacks.length];
    const baseId = String(sourceQuestion.id || `fallback-boss-q-${repeatIndex + 1}`);
    const candidateId = repeatIndex < normalizedFallbacks.length
      ? baseId
      : `${baseId}-repeat-${Math.floor(repeatIndex / normalizedFallbacks.length)}`;

    repeatIndex += 1;
    if (existingIds.has(candidateId)) continue;

    existingIds.add(candidateId);
    picked.push({
      ...sourceQuestion,
      id: candidateId,
      source: {
        ...(sourceQuestion.source || {}),
        type: 'fallback_mock',
        originalId: baseId,
        repeatIndex,
      },
    });
  }

  return picked;
}

function buildQuestionByType({ bossConfig, word, choices, index, questionType }) {
  const worldId = bossConfig?.worldId || word.worldId || word.world_id || 'wind';
  const baseSource = {
    type: word.sourceType || 'stage_word',
    questionType,
    worldId,
    stageId: word.stageId,
    wordId: word.id,
    word: word.word,
  };

  if (questionType === 'en-ja') {
    return {
      id: `${bossConfig?.bossId || 'boss'}-q-${index + 1}-${word.id}-en-ja`,
      prompt: `${word.word} の意味はどれ？`,
      choices,
      answer: word.meaningJa,
      answerIndex: choices.findIndex((choice) => choice === word.meaningJa),
      explanation: `${word.word} は日本語で ${word.meaningJa} です。`,
      source: baseSource,
    };
  }

  return {
    id: `${bossConfig?.bossId || 'boss'}-q-${index + 1}-${word.id}-ja-en`,
    prompt: `「${word.meaningJa}」は英語でどれ？`,
    choices,
    answer: word.word,
    answerIndex: choices.findIndex((choice) => choice === word.word),
    explanation: `${word.meaningJa} は英語で ${word.word} です。`,
    source: baseSource,
  };
}

function getConfiguredCount(totalCount, weight) {
  if (!weight) return 0;
  return Math.max(0, Math.round(totalCount * Number(weight)));
}

function takeUniqueWords(pool, count, selectedKeys) {
  if (count <= 0) return [];
  const picked = [];
  const shuffledPool = shuffle(pool);

  shuffledPool.forEach((word) => {
    if (picked.length >= count) return;
    const key = String(word.id || word.word).toLowerCase();
    if (selectedKeys.has(key)) return;
    selectedKeys.add(key);
    picked.push(word);
  });

  return picked;
}

export function buildBossReviewQuestions({
  bossConfig,
  stageWords = [],
  mistakeWords = [],
  importantWords = [],
  fallbackQuestions = [],
} = {}) {
  const questionCount = getTargetQuestionCount(bossConfig);
  const sourceStages = new Set((bossConfig?.reviewRule?.sourceStages || []).map(Number));
  const earlierReviewStages = new Set((
    bossConfig?.reviewRule?.reviewStages
    || bossConfig?.reviewRule?.earlierReviewStages
    || []
  ).map(Number));
  const allowedReviewStages = new Set([...sourceStages, ...earlierReviewStages]);
  const questionMix = bossConfig?.reviewRule?.questionMix || {};

  const normalizedStageWords = uniqueByWord(
    stageWords
      .map((item) => normalizeWord(item, item?.stageId || item?.stage_id || item?.stage))
      .filter(Boolean)
      .filter((word) => !sourceStages.size || sourceStages.has(Number(word.stageId)))
  ).map((word) => ({ ...word, sourceType: 'stage_word' }));
  const normalizedEarlierReviewWords = uniqueByWord(
    stageWords
      .map((item) => normalizeWord(item, item?.stageId || item?.stage_id || item?.stage))
      .filter(Boolean)
      .filter((word) => earlierReviewStages.has(Number(word.stageId)))
  ).map((word) => ({ ...word, sourceType: 'review_word' }));
  const normalizedMistakeWords = uniqueByWord(
    mistakeWords
      .map((item) => normalizeWord(item))
      .filter(Boolean)
      .filter((word) => !word.stageId || !allowedReviewStages.size || allowedReviewStages.has(Number(word.stageId)))
  ).map((word) => ({ ...word, sourceType: 'mistake_word' }));
  const normalizedImportantWords = uniqueByWord(
    importantWords
      .map((item) => normalizeWord(item))
      .filter(Boolean)
      .filter((word) => !word.stageId || !allowedReviewStages.size || allowedReviewStages.has(Number(word.stageId)))
  ).map((word) => ({ ...word, sourceType: 'important_word' }));
  const candidateWords = uniqueByWord([
    ...normalizedStageWords,
    ...normalizedEarlierReviewWords,
    ...normalizedMistakeWords,
    ...normalizedImportantWords,
  ]);

  if (candidateWords.length < 4) {
    return buildFallbackQuestions(fallbackQuestions, questionCount);
  }

  const selectedKeys = new Set();
  const stageTargetCount = getConfiguredCount(questionCount, questionMix.stageWords);
  const earlierTargetCount = getConfiguredCount(questionCount, questionMix.earlierReview);
  const mistakeTargetCount = getConfiguredCount(questionCount, questionMix.mistakes);
  const importantTargetCount = getConfiguredCount(questionCount, questionMix.importantWords);
  const selectedWords = [
    ...takeUniqueWords(normalizedStageWords, stageTargetCount, selectedKeys),
    ...takeUniqueWords(normalizedEarlierReviewWords, earlierTargetCount, selectedKeys),
    ...takeUniqueWords(normalizedMistakeWords, mistakeTargetCount, selectedKeys),
    ...takeUniqueWords(normalizedImportantWords, importantTargetCount, selectedKeys),
  ];

  if (selectedWords.length < questionCount) {
    selectedWords.push(
      ...takeUniqueWords(candidateWords, questionCount - selectedWords.length, selectedKeys)
    );
  }

  const generatedQuestions = selectedWords.map((word, index) => {
    const questionType = index % 2 === 0 ? 'ja-en' : 'en-ja';
    const correctAnswer = questionType === 'en-ja' ? word.meaningJa : word.word;
    const distractors = shuffle(candidateWords)
      .filter((item) => item.word.toLowerCase() !== word.word.toLowerCase())
      .map((item) => (questionType === 'en-ja' ? item.meaningJa : item.word))
      .filter(Boolean);
    const choices = shuffle(uniqueChoices([correctAnswer, ...distractors]).slice(0, 4));

    return buildQuestionByType({
      bossConfig,
      word,
      choices,
      index,
      questionType,
    });
  });

  if (generatedQuestions.length >= questionCount) return generatedQuestions.slice(0, questionCount);

  const existingIds = new Set(generatedQuestions.map((question) => String(question.id)));
  const fallback = buildFallbackQuestions(
    fallbackQuestions,
    questionCount - generatedQuestions.length,
    existingIds
  );

  return [...generatedQuestions, ...fallback].slice(0, questionCount);
}
