const apiFetch = async (path, options = {}) => {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${path} failed: ${response.status} ${body}`);
  }
  if (!contentType.includes('application/json')) {
    const body = await response.text();
    const preview = body.trim().slice(0, 80);
    throw new Error(`API ${path} returned non-JSON response: ${preview}`);
  }
  return response.json();
};

export const getHomeData = (childId) => {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
  return apiFetch(`/api/home${suffix}`);
};
export const getFlashcardData = ({ word, importance, frequency } = {}) => {
  const query = word ? `?word=${encodeURIComponent(word)}` : '';
  const params = new URLSearchParams(query ? query.slice(1) : '');
  if (importance) params.set('importance', importance);
  if (frequency) params.set('frequency', frequency);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/flashcard${suffix}`);
};
export const getDailyWords = (limit = 20) => apiFetch(`/api/daily-words?limit=${encodeURIComponent(limit)}`);
export const markMastered = ({ word, childId, vocabId }) => apiFetch('/api/mark-mastered', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ word, child_id: childId ?? '', vocab_id: vocabId ?? '' }),
});
export const addPokemonExp = (childId, expAmount) =>
  apiFetch('/api/pokemon-exp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ child_id: childId, exp_amount: expAmount }),
  });
export const getQuizData = ({ word, importance, frequency } = {}) => {
  const params = new URLSearchParams();
  if (word) params.set('word', word);
  if (importance) params.set('importance', importance);
  if (frequency) params.set('frequency', frequency);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/quiz${suffix}`);
};
export const getVocabExpansionQuestion = (mode) => {
  const suffix = mode ? `?mode=${encodeURIComponent(mode)}` : '';
  return apiFetch(`/api/vocab-expansion${suffix}`);
};
export const submitVocabExpansionAnswer = ({ id, selected, correct, childId }) =>
  apiFetch('/api/vocab-expansion/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, selected, correct, child_id: childId ?? '' }),
  });
export const getTodayReviewQuiz = () => apiFetch('/api/today-review-quiz');
export const getAiPracticeQuestion = (childId) => {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
  return apiFetch(`/api/ai-practice/next${suffix}`);
};
export const submitAiPracticeAnswer = ({ childId, questionId, selectedAnswer }) =>
  apiFetch('/api/ai-practice/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ child_id: childId, question_id: questionId, selected_answer: selectedAnswer }),
  });
export const startBattle = ({ childId, level } = {}) =>
  apiFetch('/api/battle/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ child_id: childId, level }),
  });
export const submitBattleAnswer = ({ sessionId, questionId, selectedAnswer }) =>
  apiFetch(`/api/battle/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, selected_answer: selectedAnswer }),
  });
export const captureBattleMonster = (sessionId) =>
  apiFetch(`/api/battle/${encodeURIComponent(sessionId)}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
export const getBattleMonsters = (childId) => {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
  return apiFetch(`/api/battle/monsters${suffix}`);
};
export const getBattleWrongQuestions = (childId) => {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
  return apiFetch(`/api/battle/wrong-questions${suffix}`);
};
export const masterBattleWrongQuestion = (wrongId) =>
  apiFetch(`/api/battle/wrong-questions/${encodeURIComponent(wrongId)}/master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
export const getEikenQuestions = ({ forceAi = false, importance, frequency } = {}) => {
  const params = new URLSearchParams({ nonce: String(Date.now()) });
  if (forceAi) {
    params.set('force_ai', '1');
  }
  if (importance) {
    params.set('importance', importance);
  }
  if (frequency) {
    params.set('frequency', frequency);
  }
  return apiFetch(`/api/eiken?${params.toString()}`, { cache: 'no-store' });
};
export const getEikenPre2Sets = () => apiFetch('/api/eiken-pre2/sets');
export const getEikenPre2Set = (setId) => apiFetch(`/api/eiken-pre2/sets/${encodeURIComponent(setId)}/questions`);
export const submitEikenPre2Attempt = ({ attemptId, studentId, childId, setId, answers, questionIds, startedAt }) =>
  apiFetch('/api/eiken-pre2/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attempt_id: attemptId,
      student_id: studentId ?? childId,
      set_id: setId,
      answers,
      question_ids: questionIds,
      started_at: startedAt,
    }),
  });
export const startEikenPre2Attempt = ({ studentId, childId, setId, mode = 'ai_training', questionIds, sourceAttemptId }) =>
  apiFetch('/api/eiken-pre2/attempts/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: studentId ?? childId,
      set_id: setId,
      mode,
      question_ids: questionIds,
      source_attempt_id: sourceAttemptId,
    }),
  });
export const submitEikenPre2Answer = ({ attemptId, questionId, studentAnswer, timeSpentSeconds, timedOut = false }) =>
  apiFetch(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_id: questionId,
      student_answer: studentAnswer,
      time_spent_seconds: timeSpentSeconds,
      timed_out: timedOut,
    }),
  });
export const completeEikenPre2Attempt = (attemptId) =>
  apiFetch(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
export const getEikenPre2Attempt = (attemptId) =>
  apiFetch(`/api/eiken-pre2/attempts/${encodeURIComponent(attemptId)}/result`);
export const getEikenPre2WrongQuestions = ({ studentId, childId, latestOnly = true, questionType, weakPointTag, limit } = {}) => {
  const params = new URLSearchParams();
  if (latestOnly) params.set('latest_only', '1');
  if (questionType) params.set('question_type', questionType);
  if (weakPointTag) params.set('weak_point_tag', weakPointTag);
  if (limit) params.set('limit', limit);
  const id = studentId ?? childId;
  return apiFetch(`/api/eiken-pre2/students/${encodeURIComponent(id)}/wrong-answers?${params.toString()}`);
};
export const submitPracticeAnswer = ({ id, word, selected, correct, childId }) =>
  apiFetch('/api/practice-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, word, selected, correct, child_id: childId ?? '' }),
  });
export const getReviewList = () => apiFetch('/api/error-review');
export const getPetsData = (childId) => {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
  return apiFetch(`/api/pokedex${suffix}`);
};
export const getPetRoomData = () => apiFetch('/api/petroom');
export const getPetLevelData = () => apiFetch('/api/petlevel');
export const getProgressData = ({ childId, date } = {}) => {
  const params = new URLSearchParams();
  if (childId) params.set('child_id', childId);
  if (date) params.set('date', date);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/progress${suffix}`);
};
export const getChildStats = (childId) => {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
  return apiFetch(`/api/child-stats${suffix}`);
};
export const getLearnedWords = (childId) => {
  const suffix = childId ? `?child_id=${encodeURIComponent(childId)}` : '';
  return apiFetch(`/api/learned-words${suffix}`);
};
export const getChildren = () => apiFetch('/api/children');
export const getChildStarterOptions = () => apiFetch('/api/child-starter-options');
export const saveChildProfile = (payload) =>
  apiFetch('/api/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
export const deleteChildProfile = (childId) =>
  apiFetch(`/api/children/${encodeURIComponent(childId)}`, {
    method: 'DELETE',
  });
export const getSettings = () => apiFetch('/api/settings');
export const saveSettings = (dailyTarget) =>
  apiFetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_target: dailyTarget }),
  });
