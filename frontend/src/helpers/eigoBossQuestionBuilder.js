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
    stageId: Number(rawWord.stageId || rawWord.stage_id || rawWord.stage || fallbackStageId || 0) || null,
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

export function buildBossReviewQuestions({
  bossConfig,
  stageWords = [],
  mistakeWords = [],
  importantWords = [],
  fallbackQuestions = [],
} = {}) {
  const questionCount = Math.max(1, Number(bossConfig?.questionCount || 8));
  const sourceStages = new Set((bossConfig?.reviewRule?.sourceStages || []).map(Number));

  // TODO Step E2:
  // Implement the configured 70/20/10 mix when mistakeWords and importantWords
  // are available in this flow. V1 uses source stage words first.
  const normalizedStageWords = uniqueByWord(
    stageWords
      .map((item) => normalizeWord(item, item?.stageId || item?.stage_id || item?.stage))
      .filter(Boolean)
      .filter((word) => !sourceStages.size || sourceStages.has(Number(word.stageId)))
  );
  const normalizedMistakeWords = uniqueByWord(mistakeWords.map((item) => normalizeWord(item)).filter(Boolean));
  const normalizedImportantWords = uniqueByWord(importantWords.map((item) => normalizeWord(item)).filter(Boolean));
  const candidateWords = uniqueByWord([
    ...normalizedStageWords,
    ...normalizedMistakeWords,
    ...normalizedImportantWords,
  ]);

  if (candidateWords.length < 4) {
    return fallbackQuestions.map(normalizeFallbackQuestion).filter(Boolean).slice(0, questionCount);
  }

  const selectedWords = shuffle(candidateWords).slice(0, questionCount);
  const generatedQuestions = selectedWords.map((word, index) => {
    const distractors = shuffle(candidateWords)
      .filter((item) => item.word.toLowerCase() !== word.word.toLowerCase())
      .map((item) => item.word)
      .filter(Boolean);
    const choices = shuffle([word.word, ...distractors.slice(0, 3)]).slice(0, 4);
    const answerIndex = choices.findIndex((choice) => choice === word.word);

    return {
      id: `${bossConfig?.bossId || 'boss'}-q-${index + 1}-${word.id}`,
      prompt: `「${word.meaningJa}」は英語でどれ？`,
      choices,
      answer: word.word,
      answerIndex,
      explanation: `${word.meaningJa} は英語で ${word.word} です。`,
      source: {
        type: 'stage_word',
        worldId: bossConfig?.worldId || word.worldId || word.world_id || 'wind',
        stageId: word.stageId,
        wordId: word.id,
        word: word.word,
      },
    };
  });

  if (generatedQuestions.length >= questionCount) return generatedQuestions.slice(0, questionCount);

  const existingIds = new Set(generatedQuestions.map((question) => String(question.id)));
  const fallback = fallbackQuestions
    .map(normalizeFallbackQuestion)
    .filter(Boolean)
    .filter((question) => !existingIds.has(String(question.id)));

  return [...generatedQuestions, ...fallback].slice(0, questionCount);
}
