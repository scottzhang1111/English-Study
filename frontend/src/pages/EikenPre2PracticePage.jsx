import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EQBottomNav } from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import { useChildren } from '../ChildrenContext';
import {
  completeEikenPre2Attempt,
  getEikenPre2Set,
  startEikenPre2Attempt,
  submitEikenPre2Answer,
} from '../api';

const QUESTION_SECONDS = 45;

const SECTION_LABELS = {
  sentence_fill: '短文の語句空所補充',
  dialogue_completion: '会話文の文空所補充',
  reading: '長文読解',
};

function flattenQuestions(questionSet, allowedIds = []) {
  const allowed = allowedIds.length ? new Set(allowedIds.map((id) => String(id))) : null;
  return (questionSet?.sections || []).flatMap((section) =>
    (section.questions || [])
      .filter((question) => !allowed || allowed.has(String(question.question_id)))
      .map((question) => ({
        ...question,
        sectionTitle: section.title || SECTION_LABELS[question.question_type] || question.question_type,
      })),
  );
}

function PageShell({ children, progressText, isResult = false }) {
  return (
    <>
      <div className="eiken-exam-page eiken-real-trial-page eiken3-mock-page mx-auto max-w-[1440px] px-3 pb-28 pt-2 text-[#26376d] lg:px-5 lg:py-4">
        <div className="eiken-real-trial-compact-wrap md:hidden">
          <CompactPageHeader
            title="英検準2級"
            subtitle={isResult ? '結果を確認しよう' : '模擬テストに挑戦'}
            backgroundImage="/assets/eigo-quest/learning-hub/英検本番形式.png"
            elementLabel="英"
            progressText={progressText}
            helperImage="/assets/eigo-quest/spirit_assets/happy.png"
            variant="eiken-real"
          />
        </div>
        <main className="eiken-real-trial-practice-layout">
          {children}
        </main>
      </div>
      <EQBottomNav className="eiken-real-trial-bottom-nav" />
    </>
  );
}

function PassageCard({ passage }) {
  if (!passage) return null;
  return (
    <section className="eiken3-mock-passage-card">
      <div className="eiken3-mock-card-head">
        <span>{passage.passage_type || passage.genre || 'Passage'}</span>
        <strong>{passage.title}</strong>
      </div>
      {passage.title_ja ? <p className="eiken3-mock-muted">{passage.title_ja}</p> : null}
      <p className="eiken3-mock-passage-text">{passage.passage_text}</p>
      {passage.key_points_ja ? <p className="eiken3-mock-note">{passage.key_points_ja}</p> : null}
    </section>
  );
}

function getQuestionSection(question) {
  return question?.sectionTitle || SECTION_LABELS[question?.question_type] || question?.section || question?.question_type || 'Question';
}

function optionClassName({ selected, result, optionKey }) {
  const isSelected = selected === optionKey;
  const isCorrect = result?.correct_option === optionKey;
  if (!result) return isSelected ? 'is-selected' : '';
  if (isCorrect) return 'is-selected';
  return isSelected ? 'is-selected is-student-wrong' : '';
}

export default function EikenPre2PracticePage() {
  const { setId } = useParams();
  const [searchParams] = useSearchParams();
  const sourceAttemptId = searchParams.get('source_attempt_id') || '';
  const navigate = useNavigate();
  const { selectedChildId, childrenLoading, childrenError } = useChildren();
  const autoStartedRef = useRef(false);

  const [questionSet, setQuestionSet] = useState(null);
  const [activeQuestionIds, setActiveQuestionIds] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [answerResults, setAnswerResults] = useState({});
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [timedOutMessage, setTimedOutMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const questions = useMemo(() => flattenQuestions(questionSet, activeQuestionIds), [questionSet, activeQuestionIds]);
  const currentQuestion = questions[currentIndex] || null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.question_id] || '' : '';
  const currentResult = currentQuestion ? answerResults[currentQuestion.question_id] : null;
  const passageMap = useMemo(() => {
    const map = new Map();
    (questionSet?.passages || []).forEach((passage) => map.set(passage.passage_id, passage));
    return map;
  }, [questionSet]);
  const currentPassage = currentQuestion?.passage || (currentQuestion?.passage_id ? passageMap.get(currentQuestion.passage_id) : null);
  const answeredCount = Object.keys(answerResults).length;
  const mistakeCount = Object.values(answerResults).filter((item) => item && item.is_correct === false).length;

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

  useEffect(() => {
    if (childrenLoading) return;
    if (autoStartedRef.current) return;
    if (childrenError) {
      setError(childrenError);
      setLoading(false);
      return;
    }
    if (!selectedChildId) {
      setError('子どもを選択してください。');
      setLoading(false);
      return;
    }
    if (!setId && !sourceAttemptId) {
      setError('セットを選択してください。');
      setLoading(false);
      return;
    }

    autoStartedRef.current = true;
    startTraining();
  }, [childrenError, childrenLoading, selectedChildId, setId, sourceAttemptId]);

  async function startTraining() {
    setLoading(true);
    setError('');
    try {
      const started = await startEikenPre2Attempt({
        childId: selectedChildId,
        setId,
        sourceAttemptId,
        mode: sourceAttemptId ? 'wrong_review' : 'ai_training',
      });
      const payload = await getEikenPre2Set(started.set_id);
      setAttempt(started);
      setQuestionSet(payload);
      setActiveQuestionIds(started.question_ids || []);
      setCurrentIndex(0);
      setAnswers({});
      setAnswerResults({});
      setTimeLeft(QUESTION_SECONDS);
      setTimedOutMessage('');
    } catch (err) {
      setError(err.message || '英検準2級の問題を読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }

  function chooseAnswer(optionKey) {
    if (!currentQuestion || currentResult) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: optionKey }));
  }

  async function submitCurrentAnswer({ timedOut = false } = {}) {
    if (!attempt || !currentQuestion || answerResults[currentQuestion.question_id] || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitEikenPre2Answer({
        attemptId: attempt.attempt_id,
        questionId: currentQuestion.question_id,
        studentAnswer: timedOut ? '' : currentAnswer,
        timeSpentSeconds: QUESTION_SECONDS - timeLeft,
        timedOut,
      });
      if (timedOut) {
        setTimedOutMessage('時間切れです。正解を確認してから次へ進もう。');
      }
      setAnswerResults((prev) => ({ ...prev, [currentQuestion.question_id]: result }));
      setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: result.student_answer || '' }));
    } catch (err) {
      setError(err.message || '回答を保存できませんでした。');
    } finally {
      setSubmitting(false);
    }
  }

  async function goNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }
    if (!attempt) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await completeEikenPre2Attempt(attempt.attempt_id);
      navigate(`/eiken-pre2/result/${encodeURIComponent(result.attempt_id)}`, { state: { result } });
    } catch (err) {
      setError(err.message || '結果を保存できませんでした。');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell progressText="PRE-2">
        <div className="eiken-real-trial-status-card eiken3-mock-status" role="status" aria-live="polite">
          <span className="eiken-real-trial-status-orb" aria-hidden="true" />
          <p>読み込み中</p>
          <strong>問題と attempt を準備しています...</strong>
        </div>
      </PageShell>
    );
  }

  if (error || !currentQuestion) {
    return (
      <PageShell progressText="PRE-2">
        <section className="eiken-real-trial-quiz-panel eiken3-mock-quiz-panel">
          {error ? <div className="eiken3-mock-alert">{error}</div> : null}
          <Link to="/eiken-pre2" className="eiken-real-trial-secondary-action eiken3-mock-top-link">
            セット一覧へ
          </Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell progressText={`${answeredCount} / ${questions.length || '-'}`}>
      <section className="eiken-real-trial-quiz-panel eiken3-mock-quiz-panel">
        <div className="eiken-real-trial-quiz-header">
          <div>
            <p>EIKEN PRE-2</p>
            <h2>{attempt?.set_id || setId}</h2>
            <strong>
              回答済み {answeredCount} / {questions.length || '-'} ・ ミス {mistakeCount}
            </strong>
          </div>
          <Link to="/eiken-pre2" className="eiken-real-trial-secondary-action eiken3-mock-top-link">
            セット一覧へ
          </Link>
        </div>

        {error ? <div className="eiken3-mock-alert">{error}</div> : null}

        <div className="eiken3-mock-quiz-stack">
          <div className="eiken3-mock-question-nav">
            {questions.map((question, index) => (
              <button
                key={question.question_id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`${index === currentIndex ? 'is-current' : ''} ${answerResults[question.question_id] ? 'is-answered' : ''}`}
              >
                {question.question_no || index + 1}
              </button>
            ))}
          </div>

          <PassageCard passage={currentPassage} />

          {timedOutMessage ? (
            <div className="eiken3-mock-note">{timedOutMessage}</div>
          ) : null}

          <article className="eiken3-mock-question-card">
            <p>
              Q{String(currentQuestion.question_no || currentIndex + 1).padStart(2, '0')} / {questions.length}
              <span>{getQuestionSection(currentQuestion)}</span>
            </p>
            <h2>{currentQuestion.prompt || currentQuestion.question_text}</h2>
            {currentQuestion.question_text_ja ? <p className="eiken3-mock-muted">{currentQuestion.question_text_ja}</p> : null}

            <div className="eiken3-mock-options">
              {(currentQuestion.options || []).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => chooseAnswer(option.key)}
                  disabled={!!currentResult}
                  className={optionClassName({ selected: currentAnswer, result: currentResult, optionKey: option.key })}
                >
                  <b>{option.key}</b>
                  <span>{option.text}</span>
                </button>
              ))}
            </div>

            {currentResult ? (
              <div className={`eiken3-mock-result-card ${currentResult.is_correct ? 'is-correct' : 'is-wrong'}`}>
                <div className="eiken3-mock-result-head">
                  <p>{currentResult.is_correct ? '正解' : 'もう一度確認'}</p>
                  <span>正解 {currentResult.correct_option}</span>
                </div>
                {currentResult.correct_answer_text ? (
                  <p className="eiken3-mock-answer-line">{currentResult.correct_answer_text}</p>
                ) : null}
                {currentResult.explanation_ja ? (
                  <p className="eiken3-mock-explanation">{currentResult.explanation_ja}</p>
                ) : null}
              </div>
            ) : null}
          </article>

          <div className="eiken-real-trial-quiz-actions">
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              disabled={currentIndex === 0 || submitting}
              className="eiken-real-trial-secondary-action"
            >
              前へ
            </button>

            <span className={`rounded-full px-4 py-2 text-sm font-black ${timeLeft <= 10 && !currentResult ? 'bg-rose-50 text-rose-700' : 'bg-[#fff2bb] text-[#69557e]'}`}>
              残り {timeLeft} 秒
            </span>

            {!currentResult ? (
              <button
                type="button"
                onClick={() => submitCurrentAnswer()}
                disabled={submitting || !currentAnswer}
                className="eiken-real-trial-gold-action"
              >
                {submitting ? '保存中...' : '回答する'}
              </button>
            ) : (
              <button type="button" onClick={goNext} disabled={submitting} className="eiken-real-trial-gold-action">
                {submitting ? '保存中...' : currentIndex < questions.length - 1 ? '次へ' : '結果を見る'}
              </button>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
