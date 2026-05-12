const DAILY_RECORDS_KEY = 'dailyLearningRecords';
const PARTNER_EXP_KEY = 'partnerExpByChildId';
export const DAILY_WORD_TARGET = 20;
export const DAILY_QUIZ_COUNT = 10;
export const DAILY_PASSING_SCORE = 8;
export const DAILY_PASS_EXP = 50;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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
    // Keep the learning flow usable even when storage is blocked.
  }
}

export function getDailyLearningRecords() {
  if (typeof window === 'undefined') return [];
  const records = readJson(DAILY_RECORDS_KEY, []);
  return Array.isArray(records) ? records : [];
}

export function saveDailyLearningRecords(records) {
  writeJson(DAILY_RECORDS_KEY, Array.isArray(records) ? records : []);
}

export function getTodayRecord(childId, date = todayKey()) {
  if (!childId) return null;
  return getDailyLearningRecords().find((record) => record.childId === childId && record.date === date) || null;
}

export function upsertTodayRecord(childId, updates, date = todayKey()) {
  const records = getDailyLearningRecords();
  const index = records.findIndex((record) => record.childId === childId && record.date === date);
  const base =
    index >= 0
      ? records[index]
      : {
          id: `daily_${childId}_${date}`,
          childId,
          date,
          targetWordCount: DAILY_WORD_TARGET,
          studiedWordIds: [],
          quizQuestionCount: 0,
          correctCount: 0,
          wrongWordIds: [],
          passed: false,
          completedAt: '',
          earnedExp: 0,
        };
  const next = { ...base, ...updates, childId, date };
  if (index >= 0) {
    records[index] = next;
  } else {
    records.push(next);
  }
  saveDailyLearningRecords(records);
  return next;
}

export function getTodayProgress(childId, targetWordCount = DAILY_WORD_TARGET) {
  const record = getTodayRecord(childId);
  if (!record) {
    return { studiedCount: 0, targetWordCount, passed: false, earnedExp: 0 };
  }
  const studiedCount = record.passed
    ? record.targetWordCount || targetWordCount
    : Math.min(record.studiedWordIds?.length || 0, record.targetWordCount || targetWordCount);
  return {
    studiedCount,
    targetWordCount: record.targetWordCount || targetWordCount,
    passed: Boolean(record.passed),
    earnedExp: record.earnedExp || 0,
  };
}

export function addPartnerExp(childId, amount) {
  if (!childId || !amount) return 0;
  const expMap = readJson(PARTNER_EXP_KEY, {});
  const current = Number(expMap[childId] || 0);
  const next = current + Number(amount || 0);
  expMap[childId] = next;
  writeJson(PARTNER_EXP_KEY, expMap);
  return next;
}

export function getPartnerExp(childId) {
  if (!childId) return 0;
  const expMap = readJson(PARTNER_EXP_KEY, {});
  return Number(expMap[childId] || 0);
}
