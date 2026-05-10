import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import WrongQuestionCard from '../components/WrongQuestionCard';
import {
  completeEikenPre2Attempt,
  getChildren,
  getEikenPre2Set,
  getEikenPre2Sets,
  startEikenPre2Attempt,
  submitEikenPre2Answer,
} from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';
const QUESTION_SECONDS = 45;
const TYPE_LABELS = {
  sentence_fill: '短句填空',
  dialogue_completion: '対話完成',
  reading: '読解',
};

function flattenQuestions(questionSet, allowedIds = []) {
  const allowed = allowedIds.length ? new Set(allowedIds) : null;
  return (questionSet?.sections || []).flatMap((section) =>
    (section.questions || [])
      .filter((question) => !allowed || allowed.has(question.question_id))
      .map((question) => ({
        ...question,
        sectionTitle: section.title || TYPE_LABELS[question.question_type] || question.question_type,
      })),
  );
}

export default function EikenPre2PracticePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const sourceAttemptId = params.get('source_attempt_id') || '';

  const [children, setChildren] = useState([]);
  const [sets, setSets] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(localStorage.getItem(CHILD_STORAGE_KEY) || '');
  const [selectedSetId, setSelectedSetId] = useState('');
  const [questionSet, setQuestionSet] = useState(null);
  const [activeQuestionIds, setActiveQuestionIds] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [answerResults, setAnswerResults] = useState({});
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [timedOutMessage, setTimedOutMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [questionSetLoading, setQuestionSetLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const questions = useMemo(() => flattenQuestions(questionSet, activeQuestionIds), [questionSet, activeQuestionIds]);
  const currentQuestion = questions[currentIndex] || null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.question_id] || '' : '';
  const currentResult = currentQuestion ? answerResults[currentQuestion.question_id] : null;
  const selectedChild = children.find((child) => String(child.id) === String(selectedChildId));

  useEffect(() => {
    let active = true;
    Promise.all([getChildren(), getEikenPre2Sets()])
      .then(([childrenPayload, setsPayload]) => {
        if (!active) return;
        const childList = childrenPayload.children || [];
        const setList = setsPayload.sets || [];
        setChildren(childList);
        setSets(setList);
        const stored = localStorage.getItem(CHILD_STORAGE_KEY);
        const childId = stored && childList.some((child) => String(child.id) === stored)
          ? stored
          : childList[0]?.id
            ? String(childList[0].id)
            : '';
        setSelectedChildId(childId);
        setSelectedSetId(setList[0]?.set_id || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    localStorage.setItem(CHILD_STORAGE_KEY, selectedChildId);
  }, [selectedChildId]);

  useEffect(() => {
    if (loading || !sourceAttemptId || !selectedChildId) return;
    startTraining({ reviewSourceAttemptId: sourceAttemptId });
  }, [loading, sourceAttemptId, selectedChildId]);

  useEffect(() => {
    setTimeLeft(QUESTION_SECONDS);
    setTimedOutMessage('');
  }, [currentIndex, currentQuestion?.question_id]);

  useEffect(() => {
    if (!attempt || !currentQuestion || currentResult) return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, currentQuestion, currentResult]);

  useEffect(() => {
    if (!attempt || !currentQuestion || currentResult || timeLeft > 0) return;
    submitCurrentAnswer({ timedOut: true });
  }, [timeLeft, attempt, currentQuestion, currentResult]);

  const startTraining = async ({ reviewSourceAttemptId = '' } = {}) => {
    if (!selectedChildId || (!selectedSetId && !reviewSourceAttemptId)) {
      setError('子どもとセットを選んでください。');
      return;
    }
    setQuestionSetLoading(true);
    setError(null);
    try {
      const started = await startEikenPre2Attempt({
        studentId: selectedChildId,
        setId: selectedSetId,
        sourceAttemptId: reviewSourceAttemptId,
        mode: reviewSourceAttemptId ? 'wrong_review' : 'ai_training',
      });
      const payload = await getEikenPre2Set(started.set_id);
      setSelectedSetId(started.set_id);
      setAttempt(started);
      setQuestionSet(payload);
      setActiveQuestionIds(started.question_ids || []);
      setCurrentIndex(0);
      setAnswers({});
      setAnswerResults({});
      setTimeLeft(QUESTION_SECONDS);
      setTimedOutMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setQuestionSetLoading(false);
    }
  };

  const chooseAnswer = (option) => {
    if (!currentQuestion || currentResult) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: option }));
  };

  const submitCurrentAnswer = async ({ timedOut = false } = {}) => {
    if (!attempt || !currentQuestion || answerResults[currentQuestion.question_id] || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitEikenPre2Answer({
        attemptId: attempt.attempt_id,
        questionId: currentQuestion.question_id,
        studentAnswer: timedOut ? '' : currentAnswer,
        timeSpentSeconds: QUESTION_SECONDS - timeLeft,
        timedOut,
      });
      if (timedOut) {
        setTimedOutMessage('時間切れです。正解を確認しましょう。');
      }
      setAnswerResults((prev) => ({ ...prev, [currentQuestion.question_id]: result }));
      setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: result.student_answer || '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }
    if (!attempt) return;
    setSubmitting(true);
    try {
      const result = await completeEikenPre2Attempt(attempt.attempt_id);
      navigate(`/eiken-pre2/result/${encodeURIComponent(result.attempt_id)}`, { state: { result } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const mergedQuestion = currentQuestion && currentResult
    ? {
        ...currentQuestion,
        ...currentResult,
        student_answer: currentResult.student_answer || '',
        correct_option: currentResult.correct_option,
        is_correct: currentResult.is_correct,
      }
    : currentQuestion;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="英検準2級 AI特訓" />

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel px-5 py-5 sm:px-7">
        <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef8ff_0%,#e3f3ff_100%)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7d8db5]">EIKEN PRE-2</p>
              <h2 className="display-font mt-2 text-2xl font-extrabold text-[#354172]">1問ずつすぐ確認</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm font-bold text-[#52668c]">
                子ども
                <select
                  value={selectedChildId}
                  onChange={(event) => setSelectedChildId(event.target.value)}
                  disabled={!!attempt}
                  className="mt-1 w-full rounded-full border border-white/80 bg-white/88 px-4 py-3 font-bold text-[#354172]"
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-[#52668c]">
                セット
                <select
                  value={selectedSetId}
                  onChange={(event) => setSelectedSetId(event.target.value)}
                  disabled={!!attempt || !!sourceAttemptId}
                  className="mt-1 w-full rounded-full border border-white/80 bg-white/88 px-4 py-3 font-bold text-[#354172]"
                >
                  {sets.map((item) => (
                    <option key={item.set_id} value={item.set_id}>{item.set_id} ({item.question_count}問)</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => startTraining()}
                disabled={loading || questionSetLoading || !!attempt || !!sourceAttemptId}
                className="pill-button px-6 py-3 disabled:opacity-50"
              >
                {questionSetLoading ? '読み込み中...' : 'はじめる'}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="mt-4 rounded-[22px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        {loading || questionSetLoading ? (
          <div className="mt-5 rounded-[24px] bg-white/76 p-6 text-center font-bold text-[#6f7da8]">準備しています...</div>
        ) : !attempt ? (
          <div className="mt-5 rounded-[24px] bg-white/76 p-6 text-center text-sm font-bold leading-7 text-[#6f7da8]">
            45秒チャレンジです。あわてず、1問ずつ確認しましょう。
            <div className="mt-4">
              <Link to="/eiken-pre2/wrong-review" className="ghost-button inline-block px-5 py-3">錯題復習へ</Link>
            </div>
          </div>
        ) : currentQuestion ? (
          <div className="mt-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#6f7da8]">{attempt.set_id} / {selectedChild?.name || 'Student'}</p>
                <h3 className="display-font mt-1 text-xl font-extrabold text-[#354172]">
                  Q{currentIndex + 1} / {questions.length} ・ {currentQuestion.sectionTitle}
                </h3>
              </div>
              <div className={`rounded-full px-4 py-2 text-sm font-black ${timeLeft <= 10 && !currentResult ? 'bg-rose-50 text-rose-700' : 'bg-[#fff2bb] text-[#69557e]'}`}>
                残り {timeLeft} 秒
              </div>
            </div>

            {timedOutMessage && (
              <div className="mb-4 rounded-[20px] bg-[#fff8d9] p-4 text-sm font-black text-[#75622c]">
                {timedOutMessage}
              </div>
            )}

            <WrongQuestionCard
              question={mergedQuestion}
              mode="practice"
              selectedAnswer={currentAnswer}
              locked={!!currentResult}
              onSelect={chooseAnswer}
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {!currentResult ? (
                <button
                  type="button"
                  onClick={() => submitCurrentAnswer()}
                  disabled={submitting || !currentAnswer}
                  className="pill-button px-5 py-3 disabled:opacity-40"
                >
                  {submitting ? '確認中...' : '回答する'}
                </button>
              ) : (
                <button type="button" onClick={goNext} disabled={submitting} className="pill-button px-5 py-3 disabled:opacity-40">
                  {submitting ? '保存中...' : currentIndex < questions.length - 1 ? '次の問題へ' : '結果を見る'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}
