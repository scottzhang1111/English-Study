import { PET_STARTER_OPTIONS, buildStaticPetCollection, decoratePet } from './lib/petMaster';

export const API_BASE_URL = '';

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

async function fetchJson(path, { method = 'GET', params, body, headers } = {}) {
  const resolvedMethod = method || 'GET';
  const response = await fetch(`${API_BASE_URL}${path}${toQuery(params)}`, {
    method: resolvedMethod,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    credentials: 'include',
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
    const error = new Error(message || `Request failed: ${response.status} ${response.statusText}`.trim());
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function normalizeApiChild(child) {
  if (!child) return null;
  return {
    ...child,
    id: String(child.id),
    nickname: child.nickname || child.name || '',
    avatar: child.avatar || '',
    learningGoal: child.learningGoal || child.learning_goal || child.targetLevel || child.target_level || '',
    dailyWordTarget: Number(child.dailyWordTarget || child.daily_word_target || child.dailyTarget || child.daily_target || 20),
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

export const loginAccount = async ({ email, code, familyCode, identifier } = {}) => {
  return fetchJson('/api/auth/login', {
    method: 'POST',
    body: { email, code, familyCode, identifier },
  });
};

export const getAuthMe = async () => {
  return fetchJson('/api/auth/me');
};

export const getAdminFamilies = async (adminCode) => {
  return fetchJson('/api/admin/families', {
    headers: { 'X-Admin-Code': adminCode },
  });
};

export const createAdminFamily = async (adminCode, payload) => {
  return fetchJson('/api/admin/families', {
    method: 'POST',
    headers: { 'X-Admin-Code': adminCode },
    body: payload,
  });
};

export const disableAdminFamilyCode = async (adminCode, codeId) => {
  return fetchJson(`/api/admin/family-codes/${encodeURIComponent(codeId)}/disable`, {
    method: 'POST',
    headers: { 'X-Admin-Code': adminCode },
    body: {},
  });
};

export const logoutAccount = async () => {
  return fetchJson('/api/auth/logout', { method: 'POST', body: {} });
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

export const getDailyReview = async (childId, options = 10) => {
  const targetCount = typeof options === 'object' ? options.targetCount : options;
  const difficulty = typeof options === 'object' ? options.difficulty : undefined;
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/daily-review`, {
    params: { target_count: targetCount || 10, difficulty },
  });
};

export const submitDailyReview = async (childId, answers) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/daily-review/submit`, {
    method: 'POST',
    body: { answers },
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

export const getVocabWrongReviews = async (childId) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/vocab-wrong-reviews`);
};

export const recordVocabWrongReview = async ({ childId, vocabId, worldId, stageNumber, questionType } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/vocab-wrong-reviews`, {
    method: 'POST',
    body: {
      vocab_id: vocabId,
      world_id: worldId,
      stage_number: stageNumber,
      question_type: questionType,
    },
  });
};

export const getVocabWrongReviewQuestion = async ({ childId, vocabId } = {}) => {
  return fetchJson(`/api/children/${encodeURIComponent(childId)}/vocab-wrong-reviews/${encodeURIComponent(vocabId)}/question`);
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

export const checkEssay = async ({ childId, topic, essayText, level } = {}) => {
  return fetchJson('/api/essay/check', {
    method: 'POST',
    body: {
      child_id: childId,
      topic,
      essay_text: essayText,
      level,
    },
  });
};

export const readWritingOcr = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  const response = await fetch(`${API_BASE_URL}/api/writing/ocr`, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.message || payload?.error || 'writing OCR failed');
    error.status = response.status;
    throw error;
  }
  return response.json();
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
  return fetchJson(`/api/grammar/lessons/${encodeURIComponent(lessonId)}/viewed`, {
    method: 'POST',
    body: { child_id: childId },
  });
};

export const submitGrammarLessonTest = async ({ childId, lessonId, answers } = {}) => {
  return fetchJson(`/api/grammar/lessons/${encodeURIComponent(lessonId)}/submit`, {
    method: 'POST',
    body: { child_id: childId, answers },
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

export const getEikenInterviewSets = async () => {
  return fetchJson('/api/eiken-interview/sets');
};

export const getEikenInterviewSet = async (setId) => {
  return fetchJson(`/api/eiken-interview/sets/${encodeURIComponent(setId)}`);
};

export const getEikenInterviewFeedback = async (payload = {}) => {
  return fetchJson('/api/eiken-interview/feedback', {
    method: 'POST',
    body: {
      child_id: payload.childId,
      set_id: payload.setId,
      question_order: payload.questionOrder,
      question_text: payload.questionText,
      student_answer: payload.studentAnswer,
      model_answer: payload.modelAnswer,
      tip_ja: payload.tipJa,
    },
  });
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

export const getEiken3Sets = async () => {
  return fetchJson('/api/eiken3/sets');
};

export const getEiken3Quiz = async (setId) => {
  return fetchJson(`/api/eiken3/quiz/${encodeURIComponent(setId)}`);
};

export const submitEiken3Quiz = async ({ setId, answers } = {}) => {
  return fetchJson('/api/eiken3/submit', {
    method: 'POST',
    body: {
      set_id: setId,
      answers,
    },
  });
};

export const getEikenRealExams = async ({ childId, targetLevel } = {}) => {
  return fetchJson('/api/eiken-real-exams', { params: { child_id: childId, target_level: targetLevel } });
};

export const getEikenRealExamPart = async (partId, { childId, targetLevel } = {}) => {
  return fetchJson(`/api/eiken-real-exams/parts/${encodeURIComponent(partId)}`, { params: { child_id: childId, target_level: targetLevel } });
};

export const submitEikenRealExamAttempt = async ({ childId, targetLevel, partId, answers, startedAt } = {}) => {
  return fetchJson('/api/eiken-real-exams/attempts', {
    method: 'POST',
    body: {
      child_id: childId,
      target_level: targetLevel,
      part_id: partId,
      answers,
      started_at: startedAt,
    },
  });
};

export const getEikenRealExamWrongQuestions = async (childId) => {
  return fetchJson('/api/eiken-real-exam/wrong-questions', { params: { child_id: childId } });
};

export const submitEikenRealExamReviewAnswer = async ({ childId, targetLevel, partId, questionNumber, selectedAnswer } = {}) => {
  return fetchJson('/api/eiken-real-exam/wrong-questions/review', {
    method: 'POST',
    body: {
      child_id: childId,
      target_level: targetLevel,
      part_id: partId,
      question_number: questionNumber,
      selected_answer: selectedAnswer,
    },
  });
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
