async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Static data ${path} failed: ${response.status} ${body.slice(0, 100)}`);
  }
  if (!contentType.includes('application/json')) {
    const body = await response.text();
    throw new Error(`Static data ${path} returned non-JSON response: ${body.trim().slice(0, 100)}`);
  }
  return response.json();
}

export const loadDailyWords = () => loadJson('/data/daily-words.json');
export const loadWordBank = () => loadJson('/data/word-bank.json');
export const loadQuizSets = () => loadJson('/data/quiz-sets.json');

export function toDailyWord(word) {
  return {
    id: word.id,
    word: word.word,
    partOfSpeech: word.partOfSpeech || word.category || '',
    meaningJa: word.meaningJa || word.jp || '',
    meaningZh: word.meaningZh || word.cn || '',
    exampleEn: word.exampleEn || word.example || '',
    exampleJa: word.exampleJa || word.example_jp || '',
    exampleZh: word.exampleZh || word.example_cn || '',
    phrase: word.phrase || '',
    importance: word.importance || '',
    frequency: word.frequency || word.frequency_in_test || '',
    reviewCount: Number(word.reviewCount || word.review_count || 0),
    wrongCount: Number(word.wrongCount || word.wrong_count || 0),
    synonyms: word.synonyms || '',
    synonymsJa: word.synonymsJa || word.synonyms_japanese || '',
    antonyms: word.antonyms || '',
    antonymsJa: word.antonymsJa || word.antonyms_japanese || '',
    hasStudied: Boolean(word.hasStudied || word.has_studied),
    familiarity: Number(word.familiarity || 0),
    needsReview: Boolean(word.needsReview || word.needs_review),
  };
}

export function readLocalJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

export function writeLocalJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Keep static mode usable even when storage is blocked.
  }
}
