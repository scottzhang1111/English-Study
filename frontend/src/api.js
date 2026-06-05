import { PET_STARTER_OPTIONS, buildStaticPetCollection, decoratePet } from './lib/petMaster';

function getDefaultApiBaseUrl() {
  if (import.meta.env.DEV) {
    return '';
  }
  return '';
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
    const contentType = response.headers.get('content-type') || '';
    let message = '';
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      message = payload?.message || payload?.error || payload?.description || '';
    } else {
      const text = await response.text().catch(() => '');
      message = text && !/<html[\s>]/i.test(text) ? text : '';
    }
    throw new Error(message || `Request failed: ${response.status} ${response.statusText}`.trim());
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

export const getHomeData = async (childId) => {
  return fetchJson('/api/home', { params: { child_id: childId } });
};

export const getHeroCards = async () => {
  return fetchJson('/api/heroes');
};

export const getChildHeroCards = async (childId) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/heroes`);
};

export const getFlashcardData = async ({ word, importance, frequency, childId } = {}) => {
  return fetchJson('/api/flashcard', { params: { word, importance, frequency, child_id: childId } });
};

export const getDailyWords = async (options = 20) => {
  const limit = typeof options === 'object' ? options.limit : options;
  const childId = typeof options === 'object' ? options.childId : undefined;
  const world = typeof options === 'object' ? options.world : undefined;
  const stage = typeof options === 'object' ? options.stage : undefined;
  return fetchJson('/api/daily-words', { params: { child_id: childId, limit, world, stage } });
};

export const getChildWordStatus = async ({ childId, level, search } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/word-status`, { params: { level, search } });
};

export const updateChildWordStatus = async ({ childId, wordId, status, isParentMarkedMastered } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/words/${encodeURIComponent(wordId)}/status`, {
    method: 'POST',
    body: { status, is_parent_marked_mastered: isParentMarkedMastered },
  });
};

export const updateChildWordsBulkStatus = async ({ childId, wordIds, status } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/words/bulk-status`, {
    method: 'POST',
    body: { word_ids: wordIds, status },
  });
};

export const updateChildStudyMode = async ({ childId, studyMode } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/study-mode`, {
    method: 'POST',
    body: { study_mode: studyMode },
  });
};

export const markMastered = async ({ word, childId, vocabId }) => {
  return fetchJson('/api/mark-mastered', {
    method: 'POST',
    body: { word, child_id: childId, vocab_id: vocabId },
  });
};

export const addPetExp = async (childId, expAmount) => {
  return fetchJson('/api/pet-exp', {
    method: 'POST',
    body: { child_id: childId, exp_amount: expAmount },
  });
};

export const getQuizData = async ({ word, childId } = {}) => {
  return fetchJson('/api/quiz', { params: { word, child_id: childId } });
};

export const getVocabExpansionQuestion = async (mode = 'synonym', childId) => {
  return fetchJson('/api/vocab-expansion', { params: { mode, child_id: childId } });
};

export const submitVocabExpansionAnswer = async ({ id, selected, correct, childId }) => {
  return fetchJson('/api/vocab-expansion/answer', {
    method: 'POST',
    body: { id, selected, correct, child_id: childId },
  });
};

export const getTodayReviewQuiz = async (childId, options = {}) => {
  return fetchJson('/api/today-review-quiz', {
    params: {
      child_id: childId,
      world: options.world,
      stage: options.stage,
      attempt_id: options.attemptId,
    },
  });
};

export const submitStageQuizAttempt = async ({ childId, world, stage, answers, attemptId } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/stage-quiz-attempts`, {
    method: 'POST',
    body: {
      world,
      stage,
      answers,
      attempt_id: attemptId,
    },
  });
};

export const getWorldStageProgress = async ({ childId, world, stage } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/world-stage-progress`, {
    params: { world, stage },
  });
};

export const markWorldStageCleared = async ({ childId, world, stage } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/world-stage-progress`, {
    method: 'POST',
    body: { world, stage, status: 'cleared' },
  });
};

export const getAiPracticeQuestion = async (childId) => {
  return fetchJson('/api/ai-practice/next', { params: { child_id: childId } });
};

export const submitAiPracticeAnswer = async ({ childId, questionId, selectedAnswer, selected } = {}) => {
  return fetchJson('/api/ai-practice/answer', {
    method: 'POST',
    body: { child_id: childId, question_id: questionId, selected_answer: selectedAnswer || selected },
  });
};

export const startBattle = async ({ childId, level } = {}) => {
  return fetchJson('/api/battle/start', { method: 'POST', body: { child_id: childId, level } });
};

export const submitBattleAnswer = async ({ sessionId, questionId, selectedAnswer } = {}) => {
  return fetchJson(`/api/battle/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST',
    body: { question_id: questionId, selected_answer: selectedAnswer },
  });
};

export const captureBattleMonster = async (sessionId) => {
  return fetchJson(`/api/battle/${encodeURIComponent(sessionId)}/capture`, { method: 'POST', body: {} });
};

export const getBattleMonsters = async (childId) => {
  const payload = await fetchJson('/api/battle/monsters', { params: { child_id: childId } });
  return {
    ...payload,
    monsters: (payload.monsters || []).map((monster, index) => ({
      ...monster,
      imageUrl: PET_STARTER_OPTIONS[index % PET_STARTER_OPTIONS.length]?.image_url || monster.imageUrl,
    })),
  };
};

export const getBattleWrongQuestions = async (childId) => {
  return fetchJson('/api/battle/wrong-questions', { params: { child_id: childId } });
};

export const masterBattleWrongQuestion = async (wrongId) => {
  return fetchJson(`/api/battle/wrong-questions/${encodeURIComponent(wrongId)}/master`, { method: 'POST', body: {} });
};

export const getGrammarLessons = async (childId) => {
  return fetchJson('/api/grammar/lessons', { params: { child_id: childId } });
};

export const getGrammarLesson = async ({ childId, lessonId } = {}) => {
  return fetchJson(`/api/grammar/lessons/${encodeURIComponent(lessonId)}`, { params: { child_id: childId } });
};

export const markGrammarLessonViewed = async ({ childId, lessonId } = {}) => {
  return fetchJson(`/api/grammar/lessons/${encodeURIComponent(lessonId)}/view`, {
    method: 'POST',
    body: { child_id: childId },
  });
};

export const submitGrammarQuizAnswer = async ({ childId, quizId, selectedIndex } = {}) => {
  return fetchJson(`/api/grammar/quizzes/${encodeURIComponent(quizId)}/answer`, {
    method: 'POST',
    body: { child_id: childId, selected_index: selectedIndex },
  });
};

export const getGrammarQuizWrongQuestions = async (childId) => {
  return fetchJson('/api/grammar/quiz-wrong-questions', { params: { child_id: childId } });
};

export const getGrammarFormPractice = async ({ childId, lessonId, limit = 5 } = {}) => {
  return fetchJson('/api/grammar/form-practice', { params: { child_id: childId, lesson_id: lessonId, limit } });
};

export const submitGrammarFormPracticeAnswer = async ({ childId, testId, selectedIndex } = {}) => {
  return fetchJson(`/api/grammar/form-practice/${encodeURIComponent(testId)}/answer`, {
    method: 'POST',
    body: { child_id: childId, selected_index: selectedIndex },
  });
};

export const getGrammarFormWrongQuestions = async (childId) => {
  return fetchJson('/api/grammar/form-practice/wrong-questions', { params: { child_id: childId } });
};

export const masterGrammarFormWrongQuestion = async ({ childId, testId } = {}) => {
  return fetchJson(`/api/grammar/form-practice/wrong-questions/${encodeURIComponent(testId)}/master`, {
    method: 'POST',
    body: { child_id: childId },
  });
};

export const getEikenQuestions = async ({ childId, forceAi, importance, frequency } = {}) => {
  return fetchJson('/api/eiken', {
    params: {
      child_id: childId,
      force_ai: forceAi ? 1 : '',
      importance,
      frequency,
      nonce: forceAi ? Date.now() : '',
    },
  });
};

export const getEikenPre2Sets = async () => {
  return fetchJson('/api/eiken-pre2/sets');
};

export const getEikenPre2Set = async (setId) => {
  return fetchJson(`/api/eiken-pre2/sets/${encodeURIComponent(setId)}`);
};

export const submitEikenPre2Attempt = async (payload) => {
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
};

export const startEikenPre2Attempt = async (payload = {}) => {
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
};

export const submitEikenPre2Answer = async ({ attemptId, questionId, studentAnswer, timeSpentSeconds, timedOut } = {}) => {
  return fetchJson(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}/answer`, {
    method: 'POST',
    body: {
      question_id: questionId,
      student_answer: studentAnswer,
      time_spent_seconds: timeSpentSeconds,
      timed_out: timedOut,
    },
  });
};

export const completeEikenPre2Attempt = async (attemptId) => {
  return fetchJson(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}/complete`, { method: 'POST', body: {} });
};

export const getEikenPre2Attempt = async (attemptId) => {
  return fetchJson(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}`);
};

export const getEikenPre2WrongQuestions = async ({ studentId, childId, latestOnly, questionType, weakPointTag, limit } = {}) => {
  return fetchJson('/api/eiken-pre2/wrong-questions', {
    params: {
      student_id: studentId || childId,
      latest_only: latestOnly ? 1 : '',
      question_type: questionType,
      weak_point_tag: weakPointTag,
      limit,
    },
  });
};

export const getEikenRealExams = async () => {
  return fetchJson('/api/eiken-real-exams');
};

export const getEikenRealExamPart = async (partId) => {
  return fetchJson(`/api/eiken-real-exams/parts/${encodeURIComponent(partId)}`);
};

export const submitEikenRealExamAttempt = async ({ childId, partId, answers, startedAt } = {}) => {
  return fetchJson('/api/eiken-real-exams/attempts', {
    method: 'POST',
    body: {
      child_id: childId,
      part_id: partId,
      answers,
      started_at: startedAt,
    },
  });
};

export const getEikenRealExamWrongQuestions = async (childId) => {
  return fetchJson('/api/eiken-real-exam/wrong-questions', { params: { child_id: childId } });
};

export const submitPracticeAnswer = async ({ id, word, selected, correct, childId }) => {
  return fetchJson('/api/practice-answer', {
    method: 'POST',
    body: { id, word, selected, correct, child_id: childId },
  });
};

export const getReviewList = async (childId) => {
  return fetchJson('/api/error-review', { params: { child_id: childId } });
};

export const getPetsData = async (childId) => {
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
};

export const getPetRoomData = async (childId) => {
  return fetchJson('/api/petroom', { params: { child_id: childId } });
};

export const getPetLevelData = async (childId) => {
  return fetchJson('/api/petlevel', { params: { child_id: childId } });
};

export const getProgressData = async ({ childId, date } = {}) => {
  return fetchJson('/api/progress', { params: { child_id: childId, date } });
};

export const getChildStats = async (childId) => {
  return fetchJson('/api/child-stats', { params: { child_id: childId } });
};

export const getLearnedWords = async (childId) => {
  return fetchJson('/api/learned-words', { params: { child_id: childId } });
};

export const getChildren = async () => {
  const payload = await fetchJson('/api/children');
  return { children: (payload.children || []).map(normalizeApiChild).filter(Boolean) };
};

export const getChildStarterOptions = async () => {
  return { options: PET_STARTER_OPTIONS };
};

export const saveChildProfile = async (payload) => {
  const result = await fetchJson('/api/children', {
    method: 'POST',
    body: payload,
  });
  return { child: normalizeApiChild(result.child) };
};

export const deleteChildProfile = async (childId) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}`, { method: 'DELETE', body: {} });
};

export const getSettings = async () => {
  return fetchJson('/api/settings');
};
export const saveSettings = async (dailyTarget) => {
  const settings = { daily_target: Number(dailyTarget || 20) };
  return fetchJson('/api/settings', { method: 'POST', body: settings });
};
