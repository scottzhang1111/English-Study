const VOCAB_PROGRESS_KEY = 'childVocabProgress';

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Keep the app usable even if localStorage is unavailable.
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeProgress(progress = {}) {
  return {
    wordId: String(progress.wordId || ''),
    hasStudied: Boolean(progress.hasStudied),
    familiarity: Number(progress.familiarity || 0),
    studiedCount: Number(progress.studiedCount || 0),
    correctCount: Number(progress.correctCount || 0),
    wrongCount: Number(progress.wrongCount || 0),
    lastStudiedAt: progress.lastStudiedAt || '',
    lastTestedAt: progress.lastTestedAt || '',
    needsReview: Boolean(progress.needsReview),
  };
}

export function getAllVocabProgress() {
  if (typeof window === 'undefined') return {};
  const progress = readJson(VOCAB_PROGRESS_KEY, {});
  return progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
}

export function saveAllVocabProgress(progress) {
  writeJson(VOCAB_PROGRESS_KEY, progress && typeof progress === 'object' ? progress : {});
}

export function getChildVocabProgress(childId) {
  if (!childId) return {};
  const allProgress = getAllVocabProgress();
  const childProgress = allProgress[childId];
  return childProgress && typeof childProgress === 'object' && !Array.isArray(childProgress) ? childProgress : {};
}

export function getWordProgress(childId, wordId) {
  const childProgress = getChildVocabProgress(childId);
  return normalizeProgress(childProgress[String(wordId)] || { wordId: String(wordId) });
}

export function updateWordProgress(childId, wordId, updates) {
  if (!childId || !wordId) return null;
  const allProgress = getAllVocabProgress();
  const childProgress = allProgress[childId] || {};
  const current = normalizeProgress(childProgress[String(wordId)] || { wordId: String(wordId) });
  const next = normalizeProgress({ ...current, ...updates, wordId: String(wordId) });
  childProgress[String(wordId)] = next;
  allProgress[childId] = childProgress;
  saveAllVocabProgress(allProgress);
  return next;
}

export function markWordsStudied(childId, wordIds) {
  if (!childId || !Array.isArray(wordIds)) return;
  const allProgress = getAllVocabProgress();
  const childProgress = allProgress[childId] || {};
  const timestamp = nowIso();

  wordIds.forEach((wordId) => {
    const id = String(wordId);
    const current = normalizeProgress(childProgress[id] || { wordId: id });
    childProgress[id] = normalizeProgress({
      ...current,
      hasStudied: true,
      familiarity: Math.max(1, current.familiarity),
      studiedCount: current.studiedCount + 1,
      lastStudiedAt: timestamp,
    });
  });

  allProgress[childId] = childProgress;
  saveAllVocabProgress(allProgress);
}

export function recordQuizResults(childId, answers) {
  if (!childId || !Array.isArray(answers)) return;
  const allProgress = getAllVocabProgress();
  const childProgress = allProgress[childId] || {};
  const timestamp = nowIso();

  answers.forEach((answer) => {
    const id = String(answer.wordId || '');
    if (!id) return;
    const current = normalizeProgress(childProgress[id] || { wordId: id });
    const wrongCount = current.wrongCount + (answer.correct ? 0 : 1);
    const correctCount = current.correctCount + (answer.correct ? 1 : 0);
    const familiarity = answer.correct
      ? Math.min(5, current.familiarity + 1)
      : Math.max(0, current.familiarity - 2);

    childProgress[id] = normalizeProgress({
      ...current,
      hasStudied: true,
      correctCount,
      wrongCount,
      familiarity,
      needsReview: wrongCount > 0 && familiarity < 4,
      lastTestedAt: timestamp,
    });
  });

  allProgress[childId] = childProgress;
  saveAllVocabProgress(allProgress);
}

export function enrichWordsWithProgress(words, childId) {
  const childProgress = getChildVocabProgress(childId);
  return words.map((word) => {
    const progress = normalizeProgress(childProgress[String(word.id)] || { wordId: String(word.id) });
    return {
      ...word,
      progress,
      hasStudied: progress.hasStudied,
      familiarity: progress.familiarity,
      wrongCount: progress.wrongCount,
      needsReview: progress.needsReview,
    };
  });
}
