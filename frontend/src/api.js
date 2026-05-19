import { addPartnerExp, getPartnerExp } from './utils/dailyLearningStorage';
import { addChild, getChildren as getLocalChildren, getCurrentChild, setCurrentChildId, updateChild } from './utils/childStorage';
import { loadDailyWords, loadQuizSets, loadWordBank, readLocalJson, toDailyWord, writeLocalJson } from './lib/staticData';
import { getChildVocabProgress, updateWordProgress } from './utils/vocabProgressStorage';
import { PET_STARTER_OPTIONS, buildStaticPetCollection, decoratePet } from './lib/petMaster';

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'api';

function getDefaultApiBaseUrl() {
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return '';
    }
    if (window.location.port === '5000') {
      return window.location.origin;
    }
  }
  return 'http://localhost:5000';
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl()).replace(/\/$/, '');

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
    studyMode: child.studyMode || child.study_mode || 'normal',
    study_mode: child.study_mode || child.studyMode || 'normal',
    partnerMonsterId: child.partnerMonsterId || child.partner_monster_id || child.starter_pokemon_id || 1,
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
    pet: decoratePet({
      pokemon_id: 1,
      level: 1,
      exp: partnerExp % 100,
      max_exp: 100,
      total_exp: partnerExp,
    }),
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

export const getChildWordStatus = async ({ childId, level, search } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/children/${encodeURIComponent(childId)}/word-status`, { params: { level, search } });
  }
  const words = await getWords();
  return {
    child_id: childId,
    study_mode: 'normal',
    levels: ['準2級'],
    words: words
      .filter((word) => !search || word.word.toLowerCase().includes(String(search).toLowerCase()) || word.jp.includes(search))
      .map((word) => ({
        id: word.id,
        word: word.word,
        japanese: word.jp,
        meaningJa: word.jp,
        level: '準2級',
        status: 'new',
        mastered_at: null,
        last_reviewed_at: null,
        wrong_count: 0,
        correct_count: 0,
        is_parent_marked_mastered: false,
      })),
  };
};

export const updateChildWordStatus = async ({ childId, wordId, status, isParentMarkedMastered } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/children/${encodeURIComponent(childId)}/words/${encodeURIComponent(wordId)}/status`, {
      method: 'POST',
      body: { status, is_parent_marked_mastered: isParentMarkedMastered },
    });
  }
  return { word: { id: wordId, status } };
};

export const updateChildWordsBulkStatus = async ({ childId, wordIds, status } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/children/${encodeURIComponent(childId)}/words/bulk-status`, {
      method: 'POST',
      body: { word_ids: wordIds, status },
    });
  }
  return { updated_count: wordIds?.length || 0, status };
};

export const updateChildStudyMode = async ({ childId, studyMode } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/children/${encodeURIComponent(childId)}/study-mode`, {
      method: 'POST',
      body: { study_mode: studyMode },
    });
  }
  return { child_id: childId, study_mode: studyMode };
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

export const addPetExp = async (childId, expAmount) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/pet-exp', {
      method: 'POST',
      body: { child_id: childId, exp_amount: expAmount },
    });
  }
  return {
    pet: { total_exp: addPartnerExp(childId, expAmount), exp: expAmount, max_exp: 100, level: 1 },
    pet_exp_awarded: expAmount,
  };
};

export const getQuizData = async ({ word, childId } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/quiz', { params: { word, child_id: childId } });
  }
  const words = await getWords();
  const mastered = readLocalJson(getMasteredKey(childId), []);
  const learnedWords = words.filter((entry) => mastered.includes(String(entry.id)) || mastered.includes(entry.word));
  const pool = learnedWords.length ? learnedWords : [];
  const item = word ? pool.find((entry) => entry.word === word) : pickRandom(pool);
  if (!item) {
    return {
      question: 'まだ復習できる単語がありません。まず単語カードで覚えましょう。',
      choices: [],
      correct: '',
      word: '',
      id: '',
      mastered_count: mastered.length,
      error_count: 0,
      review_mode: 'mastered_words',
    };
  }
  const choices = shuffle([item.word, ...shuffle(pool.filter((entry) => entry.id !== item.id)).slice(0, 3).map((entry) => entry.word)]);
  const example = item.example || '';
  const question = example
    ? example.replace(new RegExp(`\\b${item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '____')
    : `Choose the word that fits: ____`;
  return {
    question,
    choices,
    correct: item.word,
    word: item.word,
    id: item.id,
    japanese: item.jp,
    example: item.example,
    example_jp: item.example_jp,
    mastered_count: mastered.length,
    error_count: 0,
    review_mode: 'static_words',
  };
};

export const getVocabExpansionQuestion = async (mode = 'synonym', childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/vocab-expansion', { params: { mode, child_id: childId } });
  }
  const words = await getWords();
  const mastered = readLocalJson(getMasteredKey(childId), []);
  const learnedWords = words.filter((word) => mastered.includes(String(word.id)) || mastered.includes(word.word));
  const requestedMode = mode === 'antonym' ? 'antonym' : 'synonym';
  const key = requestedMode === 'synonym' ? 'synonyms' : 'antonyms';
  const learnedSet = new Set(learnedWords.map((word) => word.word.toLowerCase()));
  const candidates = learnedWords.filter((word) => splitTerms(word[key]).some((term) => learnedSet.has(term.toLowerCase())));
  const item = pickRandom(candidates);
  if (!item) {
    throw new Error('まだ練習できる単語がありません。まず単語カードで覚えましょう。');
  }
  const correct = pickRandom(splitTerms(item[key]).filter((term) => learnedSet.has(term.toLowerCase())));
  const pool = learnedWords
    .flatMap((word) => [...splitTerms(word.synonyms), ...splitTerms(word.antonyms)])
    .filter((term) => learnedSet.has(term.toLowerCase()) && term !== correct);
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
  const quiz = await getQuizData({ childId });
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
  return { session_id: `static_${Date.now()}`, question: await getQuizData({ childId }), monster: null };
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
    const payload = await fetchJson('/api/battle/monsters', { params: { child_id: childId } });
    return {
      ...payload,
      monsters: (payload.monsters || []).map((monster, index) => ({
        ...monster,
        imageUrl: PET_STARTER_OPTIONS[index % PET_STARTER_OPTIONS.length]?.image_url || monster.imageUrl,
      })),
    };
  }
  return {
  monsters: [
    {
      id: 'comparison_cat',
      nameJa: 'くらべキャット',
      imageUrl: '/assets/pets/elec/ELEC_CAT1.png',
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

export const getGrammarLessons = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/grammar/lessons', { params: { child_id: childId } });
  }
  return {
    childId,
    lessons: [],
    todayLesson: null,
    stats: { total: 0, mastered: 0, learning: 0, remaining: 0, dailyTarget: 1 },
  };
};

export const getGrammarLesson = async ({ childId, lessonId } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/grammar/lessons/${encodeURIComponent(lessonId)}`, { params: { child_id: childId } });
  }
  return { childId, lesson: null };
};

export const markGrammarLessonViewed = async ({ childId, lessonId } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/grammar/lessons/${encodeURIComponent(lessonId)}/view`, {
      method: 'POST',
      body: { child_id: childId },
    });
  }
  return getGrammarLesson({ childId, lessonId });
};

export const submitGrammarQuizAnswer = async ({ childId, quizId, selectedIndex } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/grammar/quizzes/${encodeURIComponent(quizId)}/answer`, {
      method: 'POST',
      body: { child_id: childId, selected_index: selectedIndex },
    });
  }
  return { childId, quizId, selectedIndex, correctIndex: 0, isCorrect: selectedIndex === 0, explanationJp: '' };
};

export const getGrammarFormPractice = async ({ childId, limit = 5 } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/grammar/form-practice', { params: { child_id: childId, limit } });
  }
  return { childId, learnedLessonCount: 0, questions: [] };
};

export const submitGrammarFormPracticeAnswer = async ({ childId, testId, selectedIndex } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/grammar/form-practice/${encodeURIComponent(testId)}/answer`, {
      method: 'POST',
      body: { child_id: childId, selected_index: selectedIndex },
    });
  }
  return { childId, testId, selectedIndex, correctIndex: 0, isCorrect: selectedIndex === 0, correctAnswer: '', correctReasonJp: '' };
};

export const getGrammarFormWrongQuestions = async (childId) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/grammar/form-practice/wrong-questions', { params: { child_id: childId } });
  }
  return { childId, wrongQuestions: [] };
};

export const masterGrammarFormWrongQuestion = async ({ childId, testId } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson(`/api/grammar/form-practice/wrong-questions/${encodeURIComponent(testId)}/master`, {
      method: 'POST',
      body: { child_id: childId },
    });
  }
  return { childId, testId, mastered: true };
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

export const getEikenRealExams = async () => {
  if (DATA_MODE !== 'static') return fetchJson('/api/eiken-real-exams');
  return { exams: [] };
};

export const getEikenRealExamPart = async (partId) => {
  if (DATA_MODE !== 'static') return fetchJson(`/api/eiken-real-exams/parts/${encodeURIComponent(partId)}`);
  return { part_id: partId, html: '', audio_paths: [], question_count: 0 };
};

export const submitEikenRealExamAttempt = async ({ childId, partId, answers, startedAt } = {}) => {
  if (DATA_MODE !== 'static') {
    return fetchJson('/api/eiken-real-exams/attempts', {
      method: 'POST',
      body: {
        child_id: childId,
        part_id: partId,
        answers,
        started_at: startedAt,
      },
    });
  }
  return { answer_key_available: false, answered_count: Object.keys(answers || {}).length, total_questions: 0 };
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
    const payload = await fetchJson('/api/pokedex', { params: { child_id: childId } });
    const pets = buildStaticPetCollection(payload.pets || []);
    const currentPet = decoratePet(payload.current_pet || pets.find((pet) => pet.unlocked) || pets[0]);
    const ownedCount = pets.filter((pet) => pet.unlocked).length;
    return {
      ...payload,
      pets,
      current_pet: currentPet,
      owned_count: ownedCount,
      total_count: pets.length,
      reward_status: {
        ...(payload.reward_status || {}),
        has_locked_pokemon: ownedCount < pets.length,
      },
    };
  }
  const pets = buildStaticPetCollection([
    { pokemon_id: 1, level: 1, exp: 0, max_exp: 100, exp_progress: 0, total_exp: 0 },
  ]);
  return {
  child: null,
  pets,
  current_pet: pets[0],
  owned_count: 1,
  total_count: pets.length,
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
  return { options: PET_STARTER_OPTIONS };
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
    : addChild({ name: payload.name, grade: payload.grade, targetLevel: payload.target_level, partnerMonsterId: String(payload.starter_pokemon_id || 1) });
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
