import { addPartnerExp, getPartnerExp } from './utils/dailyLearningStorage';
import { addChild, getChildren as getLocalChildren, getCurrentChild, setCurrentChildId, updateChild } from './utils/childStorage';
import { loadDailyWords, loadQuizSets, loadWordBank, readLocalJson, toDailyWord, writeLocalJson } from './lib/staticData';
import { getChildVocabProgress, updateWordProgress } from './utils/vocabProgressStorage';

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'api';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function toQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function fetchJson(path, { method = 'GET', params, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}${toQuery(params)}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeApiChild(child) {
  if (!child) return null;
  return {
    ...child,
    id: String(child.id),
    targetLevel: child.targetLevel || child.target_level || '',
    dailyTarget: Number(child.dailyTarget || child.daily_target || 20),
    partnerMonsterId: child.partnerMonsterId || child.partner_monster_id || child.starter_pokemon_id || 'bulbasaur',
  };
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeWord(word) {
  return {
    id: word.id,
    word: word.word,
    jp: word.jp || word.meaningJa || '',
    cn: word.cn || word.meaningZh || '',
    category: word.category || word.partOfSpeech || '',
    example: word.example || word.exampleEn || '',
    example_jp: word.example_jp || word.exampleJa || '',
    example_cn: word.example_cn || word.exampleZh || '',
    example_short: word.example || word.exampleEn || '',
    phrase: word.phrase || '',
    importance: word.importance || '',
    frequency_in_test: word.frequency_in_test || word.frequency || '',
    synonyms: word.synonyms || '',
    synonyms_japanese: word.synonyms_japanese || word.synonymsJa || '',
    antonyms: word.antonyms || '',
    antonyms_japanese: word.antonyms_japanese || word.antonymsJa || '',
  };
}

async function getWords() {
  const payload = await loadWordBank();
  return (payload.words || []).map(normalizeWord);
}

function getMasteredKey(childId) {
  return `masteredWords:${childId || 'default'}`;
}

function getWrongKey(childId) {
  return `wrongWords:${childId || 'default'}`;
}

function splitTerms(value) {
  return String(value || '')
    .split(/[;,/、，；]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export const getHomeData = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/home', { params: { child_id: childId } });
  }
  const words = await getWords();
  const activeChild = childId ? null : getCurrentChild();
  const activeChildId = childId || activeChild?.id || 'default';
  const mastered = readLocalJson(getMasteredKey(activeChildId), []);
  const partnerExp = getPartnerExp(activeChildId);
  return {
    progress: mastered.length,
    target: 20,
    remain: Math.max(0, 20 - mastered.length),
    total_words: words.length,
    mastered_words: mastered.length,
    study_days: mastered.length > 0 ? 1 : 0,
    pet: {
      pokemon_id: 25,
      name: 'Pikachu',
      level: 1,
      exp: partnerExp % 100,
      max_exp: 100,
      total_exp: partnerExp,
      image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
    },
  };
};

export const getFlashcardData = async ({ word, importance, frequency, childId } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/flashcard', { params: { word, importance, frequency, child_id: childId } });
  }
  let words = await getWords();
  if (importance && importance !== 'ALL') {
    words = words.filter((item) => item.importance === importance);
  }
  if (frequency && frequency !== 'ALL') {
    words = words.filter((item) => item.frequency_in_test === frequency);
  }
  const selected = word
    ? words.find((item) => item.word.toLowerCase() === word.toLowerCase() || String(item.id) === String(word))
    : pickRandom(words);
  const item = selected || words[0];
  return { ...item, sentence_jp: item.example_jp };
};

export const getDailyWords = async (options = 20) => {
  const limit = typeof options === 'object' ? options.limit : options;
  const childId = typeof options === 'object' ? options.childId : undefined;
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/daily-words', { params: { child_id: childId, limit } });
  }
  const payload = await loadWordBank();
  const words = (payload.words || []).map(toDailyWord);
  const limitedWords = Number.isFinite(Number(limit)) ? words.slice(0, Number(limit)) : words;
  return {
    targetWordCount: Number(payload.targetWordCount || 20),
    words: limitedWords,
  };
};

export const markMastered = async ({ word, childId, vocabId }) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/mark-mastered', {
      method: 'POST',
      body: { word, child_id: childId, vocab_id: vocabId },
    });
  }
  const key = getMasteredKey(childId);
  const mastered = readLocalJson(key, []);
  const id = String(vocabId || word || '');
  const next = mastered.includes(id) ? mastered : [...mastered, id];
  writeLocalJson(key, next);
  return { progress: next.length, target: 20, remain: Math.max(0, 20 - next.length), mastered_words: next };
};

export const addPokemonExp = async (childId, expAmount) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/pokemon-exp', {
      method: 'POST',
      body: { child_id: childId, exp_amount: expAmount },
    });
  }
  return {
    pet: { total_exp: addPartnerExp(childId, expAmount), exp: expAmount, max_exp: 100, level: 1 },
    pet_exp_awarded: expAmount,
  };
};

export const getQuizData = async ({ word } = {}) => {
  const words = await getWords();
  const item = word ? words.find((entry) => entry.word === word) || pickRandom(words) : pickRandom(words);
  const choices = shuffle([item.word, ...shuffle(words.filter((entry) => entry.id !== item.id)).slice(0, 3).map((entry) => entry.word)]);
  return {
    question: `「${item.jp}」は英語でどれ？`,
    choices,
    correct: item.word,
    word: item.word,
    id: item.id,
    japanese: item.jp,
    example: item.example,
    example_jp: item.example_jp,
    mastered_count: readLocalJson(getMasteredKey('default'), []).length,
    error_count: 0,
    review_mode: 'static_words',
  };
};

export const getVocabExpansionQuestion = async (mode = 'synonym') => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/vocab-expansion', { params: { mode } });
  }
  const words = await getWords();
  const requestedMode = mode === 'antonym' ? 'antonym' : 'synonym';
  const key = requestedMode === 'synonym' ? 'synonyms' : 'antonyms';
  const candidates = words.filter((word) => splitTerms(word[key]).length > 0);
  const item = pickRandom(candidates.length ? candidates : words);
  const correct = pickRandom(splitTerms(item[key]).length ? splitTerms(item[key]) : [item.word]);
  const pool = words.flatMap((word) => [...splitTerms(word.synonyms), ...splitTerms(word.antonyms)]).filter((term) => term !== correct);
  return {
    id: item.id,
    word: item.word,
    mode: requestedMode,
    question: `Choose the best ${requestedMode} for "${item.word}".`,
    choices: shuffle([correct, ...shuffle(pool).slice(0, 3)]),
    correct,
    japanese: item.jp,
    chinese: item.cn,
    example: item.example,
    example_jp: item.example_jp,
    phrase: item.phrase,
    synonyms: splitTerms(item.synonyms),
    synonyms_japanese: item.synonyms_japanese,
    antonyms: splitTerms(item.antonyms),
    antonyms_japanese: item.antonyms_japanese,
  };
};

export const submitVocabExpansionAnswer = async ({ id, selected, correct, childId }) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/vocab-expansion/answer', {
      method: 'POST',
      body: { id, selected, correct, child_id: childId },
    });
  }
  const isCorrect = selected === correct;
  if (!isCorrect) {
    const wrong = readLocalJson(getWrongKey(childId), []);
    writeLocalJson(getWrongKey(childId), [...wrong, id]);
    const current = childId ? getChildVocabProgress(childId)[String(id)] : null;
    updateWordProgress(childId, id, {
      wrongCount: Number(current?.wrongCount || 0) + 1,
      familiarity: Math.max(0, Number(current?.familiarity || 0) - 1),
      needsReview: true,
    });
  }
  return { correct: isCorrect, correct_answer: correct, selected, pet_exp_awarded: isCorrect ? 5 : 0 };
};

export const getTodayReviewQuiz = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/today-review-quiz', { params: { child_id: childId } });
  }
  const payload = await loadQuizSets();
  return { questions: payload.review || [] };
};

export const getAiPracticeQuestion = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/ai-practice/next', { params: { child_id: childId } });
  }
  const quiz = await getQuizData();
  return { question: { ...quiz, question_type: 'multiple_choice' } };
};

export const submitAiPracticeAnswer = async ({ childId, questionId, selectedAnswer, selected } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/ai-practice/answer', {
      method: 'POST',
      body: { child_id: childId, question_id: questionId, selected_answer: selectedAnswer || selected },
    });
  }
  return { correct: Boolean(selectedAnswer || selected), explanation: 'Static mode result.' };
};

export const startBattle = async ({ childId, level } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/battle/start', { method: 'POST', body: { child_id: childId, level } });
  }
  return { session_id: `static_${Date.now()}`, question: await getQuizData(), monster: null };
};
export const submitBattleAnswer = async ({ sessionId, questionId, selectedAnswer } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/battle/${encodeURIComponent(sessionId)}/answer`, {
      method: 'POST',
      body: { question_id: questionId, selected_answer: selectedAnswer },
    });
  }
  return { correct: true, explanation: 'Static mode battle answer.' };
};
export const captureBattleMonster = async (sessionId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/battle/${encodeURIComponent(sessionId)}/capture`, { method: 'POST', body: {} });
  }
  return { captured: true };
};
export const getBattleMonsters = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/battle/monsters', { params: { child_id: childId } });
  }
  return {
  monsters: [
    {
      id: 'comparison_cat',
      nameJa: 'くらべキャット',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/300.png',
      grammarCategory: 'comparison',
      captured: true,
      level: 1,
      exp: 0,
      grammarTip: '比較のポイントを確認しよう。',
    },
  ],
  };
};
export const getBattleWrongQuestions = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/battle/wrong-questions', { params: { child_id: childId } });
  }
  return { questions: [] };
};
export const masterBattleWrongQuestion = async (wrongId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/battle/wrong-questions/${encodeURIComponent(wrongId)}/master`, { method: 'POST', body: {} });
  }
  return { mastered: true };
};

export const getEikenQuestions = async ({ childId, forceAi, importance, frequency } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/eiken', {
      params: {
        child_id: childId,
        force_ai: forceAi ? 1 : '',
        importance,
        frequency,
        nonce: forceAi ? Date.now() : '',
      },
    });
  }
  const payload = await loadQuizSets();
  return { questions: payload.eiken || [], source: 'static', warning: '' };
};

export const getEikenPre2Sets = async () => {
  if (DATA_MODE !== 'static') return fetchJson('/api/eiken-pre2/sets');
  return { sets: [] };
};
export const getEikenPre2Set = async (setId) => {
  if (DATA_MODE !== 'static') return fetchJson(`/api/eiken-pre2/sets/${encodeURIComponent(setId)}`);
  return { set_id: setId, questions: [] };
};
export const submitEikenPre2Attempt = async (payload) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/eiken-pre2/attempts', {
      method: 'POST',
      body: {
        student_id: payload.studentId || payload.childId,
        child_id: payload.childId || payload.studentId,
        set_id: payload.setId,
        answers: payload.answers,
        started_at: payload.startedAt,
        attempt_id: payload.attemptId,
        question_ids: payload.questionIds,
      },
    });
  }
  return { ...payload, saved: true };
};
export const startEikenPre2Attempt = async (payload = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/eiken-pre2/attempts/start', {
      method: 'POST',
      body: {
        student_id: payload.studentId || payload.childId,
        child_id: payload.childId || payload.studentId,
        set_id: payload.setId,
        mode: payload.mode,
        source_attempt_id: payload.sourceAttemptId,
      },
    });
  }
  return { attempt_id: `static_${Date.now()}`, questions: [] };
};
export const submitEikenPre2Answer = async ({ attemptId, questionId, studentAnswer, timeSpentSeconds, timedOut } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}/answer`, {
      method: 'POST',
      body: {
        question_id: questionId,
        student_answer: studentAnswer,
        time_spent_seconds: timeSpentSeconds,
        timed_out: timedOut,
      },
    });
  }
  return { saved: true };
};
export const completeEikenPre2Attempt = async (attemptId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}/complete`, { method: 'POST', body: {} });
  }
  return { completed: true };
};
export const getEikenPre2Attempt = async (attemptId) => {
  if (DATA_MODE !== 'static') return fetchJson(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}`);
  return { attempt: null, answers: [] };
};
export const getEikenPre2WrongQuestions = async ({ studentId, childId, latestOnly, questionType, weakPointTag, limit } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/eiken-pre2/wrong-questions', {
      params: {
        student_id: studentId || childId,
        latest_only: latestOnly ? 1 : '',
        question_type: questionType,
        weak_point_tag: weakPointTag,
        limit,
      },
    });
  }
  return { wrong_answers: [] };
};

export const submitPracticeAnswer = async ({ id, word, selected, correct, childId }) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/practice-answer', {
      method: 'POST',
      body: { id, word, selected, correct, child_id: childId },
    });
  }
  const isCorrect = String(selected).toLowerCase() === String(correct).toLowerCase();
  const progress = childId ? getChildVocabProgress(childId)[String(id || word)] : null;
  if (isCorrect) {
    await markMastered({ word, childId, vocabId: id });
    updateWordProgress(childId, id || word, {
      correctCount: Number(progress?.correctCount || 0) + 1,
      familiarity: Math.min(5, Number(progress?.familiarity || 0) + 1),
    });
  } else {
    const wrong = readLocalJson(getWrongKey(childId), []);
    writeLocalJson(getWrongKey(childId), [...wrong, id || word]);
    updateWordProgress(childId, id || word, {
      wrongCount: Number(progress?.wrongCount || 0) + 1,
      familiarity: Math.max(0, Number(progress?.familiarity || 0) - 1),
      needsReview: true,
    });
  }
  return { correct: isCorrect, correct_answer: correct, id, selected, pet_exp_awarded: isCorrect ? 10 : 0 };
};

export const getReviewList = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/error-review', { params: { child_id: childId } });
  }
  const words = await getWords();
  const child = getCurrentChild();
  const activeChildId = childId || child?.id || 'default';
  const progress = getChildVocabProgress(activeChildId);
  const progressItems = Object.values(progress)
    .filter((item) => item?.needsReview || Number(item?.wrongCount || 0) > 0)
    .sort((a, b) => Number(b.wrongCount || 0) - Number(a.wrongCount || 0) || Number(a.familiarity || 0) - Number(b.familiarity || 0));
  const progressIds = progressItems.map((item) => item.wordId);
  const wrongIds = [...progressIds, ...readLocalJson(getWrongKey(activeChildId), [])];
  const uniqueWrongIds = Array.from(new Set(wrongIds.map(String))).filter(Boolean);
  return {
    review_list: uniqueWrongIds.map((id) => {
      const word = words.find((item) => String(item.id) === String(id)) || words[0];
      const itemProgress = progress[String(id)] || {};
      return {
        word_id: id,
        id: word.id,
        word: word.word,
        japanese: word.jp,
        example_japanese: word.example_jp,
        error_count: Number(itemProgress.wrongCount || 1),
        familiarity: Number(itemProgress.familiarity || 0),
      };
    }),
  };
};

export const getPetsData = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/pokedex', { params: { child_id: childId } });
  }
  return {
  child: null,
  pets: [
    {
      pokemon_id: 1,
      name: 'フシギダネ',
      level: 1,
      exp: 0,
      max_exp: 100,
      exp_progress: 0,
      total_exp: 0,
      unlocked: true,
      image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png',
    },
  ],
  current_pet: {
    pokemon_id: 1,
    name: 'フシギダネ',
    level: 1,
    exp: 0,
    max_exp: 100,
    exp_progress: 0,
    total_exp: 0,
    unlocked: true,
    image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png',
  },
  owned_count: 1,
  total_count: 151,
  reward_status: { today_progress: 0, today_target: 20, today_progress_percent: 0, next_unlock_exp: 20, has_locked_pokemon: true },
  };
};

export const getPetRoomData = async (childId) => {
  if (DATA_MODE !== 'static') return fetchJson('/api/petroom', { params: { child_id: childId } });
  return { pets: [] };
};
export const getPetLevelData = async (childId) => {
  if (DATA_MODE !== 'static') return fetchJson('/api/petlevel', { params: { child_id: childId } });
  return { pet: null };
};
export const getProgressData = async ({ childId, date } = {}) => {
  if (DATA_MODE !== 'static') return fetchJson('/api/progress', { params: { child_id: childId, date } });
  return { daily: [], summary: {} };
};
export const getChildStats = async (childId) => {
  if (DATA_MODE !== 'static') return fetchJson('/api/child-stats', { params: { child_id: childId } });
  return { child: null, today: {}, total_studied_words: 0, top_wrong_words: [] };
};
export const getLearnedWords = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/learned-words', { params: { child_id: childId } });
  }
  const words = await getWords();
  const mastered = readLocalJson(getMasteredKey(childId), []);
  return { child: null, count: mastered.length, words: words.filter((word) => mastered.includes(String(word.id))) };
};

export const getChildren = async () => {
  if (DATA_MODE !== 'static') {
    const payload = await fetchJson('/api/children');
    return { children: (payload.children || []).map(normalizeApiChild).filter(Boolean) };
  }
  return {
    children: getLocalChildren().map((child) => ({
      id: child.id,
      name: child.name,
      grade: child.grade,
      target_level: child.targetLevel,
      targetLevel: child.targetLevel,
      daily_target: 20,
      starter_pokemon_id: 1,
      partnerMonsterId: child.partnerMonsterId,
    })),
  };
};

export const getChildStarterOptions = async () => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/child-starter-options');
  }
  return {
    options: [
      { id: 4, name: 'ヒトカゲ', image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png', sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png', types: [{ name: 'fire' }] },
      { id: 7, name: 'ゼニガメ', image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png', sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png', types: [{ name: 'water' }] },
      { id: 1, name: 'フシギダネ', image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png', sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', types: [{ name: 'grass' }] },
    ],
  };
};

export const saveChildProfile = async (payload) => {
  if (DATA_MODE !== 'static') {
    const result = await fetchJson('/api/children', {
      method: 'POST',
      body: payload,
    });
    return { child: normalizeApiChild(result.child) };
  }
  const existing = getLocalChildren().find((child) => child.id === payload.id);
  const child = existing
    ? updateChild(existing.id, { name: payload.name, grade: payload.grade, targetLevel: payload.target_level })
    : addChild({ name: payload.name, grade: payload.grade, targetLevel: payload.target_level, partnerMonsterId: 'bulbasaur' });
  setCurrentChildId(child.id);
  return { child };
};

export const deleteChildProfile = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/children/${encodeURIComponent(childId)}`, { method: 'DELETE', body: {} });
  }
  const children = getLocalChildren().filter((child) => String(child.id) !== String(childId));
  localStorage.setItem('children', JSON.stringify(children));
  return { deleted: true, child_id: childId };
};

export const getSettings = async () => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/settings');
  }
  return readLocalJson('settings', { daily_target: 20 });
};
export const saveSettings = async (dailyTarget) => {
  const settings = { daily_target: Number(dailyTarget || 20) };
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/settings', { method: 'POST', body: settings });
  }
  writeLocalJson('settings', settings);
  return settings;
};

export { DATA_MODE };
