import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  EQBadge,
  EQBottomNav,
  EQChoiceButton,
  EQMobileShell,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';
import { getGrammarLesson, submitGrammarQuizAnswer } from '../api';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

const CHILD_STORAGE_KEY = 'selected_child_id';
const PRACTICE_QUESTION_LIMIT = 5;
const GRAMMAR_HERO_IMAGE = '/assets/eigo-quest/learning-hub/文法練習.png';
const SPIRIT_IMAGE = '/assets/eigo-quest/spirit_assets/happy.png';

function getLessonValue(lesson, fieldName) {
  if (!lesson) return '';
  if (lesson[fieldName]) return lesson[fieldName];
  const fallbackEntry = Object.entries(lesson).find(([key, value]) => (
    value && String(key).trim().endsWith(fieldName)
  ));
  return fallbackEntry?.[1] || '';
}

export default function GrammarFormPracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const lessonId = searchParams.get('lessonId') || '';
  const [lesson, setLesson] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [results, setResults] = useState([]);
  const [retryQuestions, setRetryQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const question = questions[index] || null;
  const isLast = index >= questions.length - 1;
  const correctCount = results.filter((item) => item.isCorrect).length;
  const passTarget = Math.min(questions.length || PRACTICE_QUESTION_LIMIT, PRACTICE_QUESTION_LIMIT);
  const remainingToPass = Math.max(0, passTarget - correctCount);
  const currentCount = questions.length ? Math.min(index + 1, questions.length) : 0;
  const selectedAnswerText = question && selectedIndex !== null ? question.choices[selectedIndex] : '';
  const grammarPoint = getLessonValue(lesson, 'grammarPoint');
  const missedQuizIds = results
    .filter((item) => !item.isCorrect && item.quizId)
    .map((item) => item.quizId);

  const loadPractice = () => {
    setLoading(true);
    setError('');
    setIndex(0);
    setSelectedIndex(null);
    setAnswerResult(null);
    setResults([]);
    setRetryQuestions([]);
    setLesson(null);
    if (!lessonId) {
      setQuestions([]);
      setError('文法レッスンからテストへ進んでください。');
      setLoading(false);
      return;
    }
    getGrammarLesson({ childId, lessonId })
      .then((payload) => {
        const nextLesson = payload.lesson || null;
        setLesson(nextLesson);
        setQuestions((nextLesson?.quizzes || []).slice(0, PRACTICE_QUESTION_LIMIT));
      })
      .catch((err) => setError(err.message || '文法練習を読み込めませんでした。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }
    loadPractice();
  }, [childId, lessonId, navigate]);

  const handleAnswer = () => {
    if (!question || selectedIndex === null || submitting || answerResult) return;
    setSubmitting(true);
    submitGrammarQuizAnswer({ childId, quizId: question.quizId, selectedIndex })
      .then((payload) => {
        const nextResult = { ...payload, quizId: question.quizId };
        setAnswerResult(nextResult);
        setResults((items) => [...items, nextResult]);
      })
      .catch((err) => setError(err.message || '答えを保存できませんでした。'))
      .finally(() => setSubmitting(false));
  };

  const handleNext = () => {
    if (!isLast) {
      setIndex((current) => current + 1);
      setSelectedIndex(null);
      setAnswerResult(null);
      return;
    }
    setRetryQuestions(questions.filter((item) => missedQuizIds.includes(item.quizId)));
    setIndex(questions.length);
  };

  const handleRetryMissed = () => {
    setQuestions(retryQuestions);
    setIndex(0);
    setSelectedIndex(null);
    setAnswerResult(null);
    setResults([]);
    setRetryQuestions([]);
  };

  const renderBody = () => {
    if (loading) {
      return (
        <EQPanel tone="cyan">
          <p className="eq-caption text-center">練習問題を準備しています...</p>
        </EQPanel>
      );
    }

    if (error) {
      return (
        <EQPanel title="読み込みエラー" tone="rose">
          <p className="eq-caption">{error}</p>
          <div className="grid gap-3">
            <EQPrimaryButton type="button" onClick={loadPractice} fullWidth>
              もう一度
            </EQPrimaryButton>
            <EQPrimaryButton type="button" onClick={() => navigate('/grammar')} fullWidth>
              文法へ
            </EQPrimaryButton>
          </div>
        </EQPanel>
      );
    }

    if (!questions.length) {
      return (
        <EQPanel title="文法テストがありません" tone="gold">
          <p className="eq-caption">まずは文法レッスンを進めましょう。</p>
          <EQPrimaryButton type="button" onClick={() => navigate('/grammar')} fullWidth>
            文法へ
          </EQPrimaryButton>
        </EQPanel>
      );
    }

    if (index >= questions.length) {
      const hasMissedQuestions = retryQuestions.length > 0;
      return (
        <EQPanel title={hasMissedQuestions ? 'あと少し！' : '結果'} tone="gold">
          <div className="flex flex-wrap gap-2">
            <EQBadge tone="gold">正解 {correctCount} / {questions.length}</EQBadge>
            <EQBadge tone={remainingToPass === 0 ? 'green' : 'rose'}>
              合格まで {remainingToPass} 問
            </EQBadge>
          </div>
          <p className="eq-caption">
            {hasMissedQuestions
              ? 'まちがえた問題だけ、もう一度チャレンジしよう。'
              : 'よくできました。文法レッスンにもどりましょう。'}
          </p>
          <div className="grid gap-3">
            {hasMissedQuestions ? (
              <EQPrimaryButton type="button" onClick={handleRetryMissed} fullWidth>
                まちがえた問題に挑戦
              </EQPrimaryButton>
            ) : (
              <EQPrimaryButton type="button" onClick={() => navigate('/grammar')} fullWidth>
                文法へ
              </EQPrimaryButton>
            )}
          </div>
        </EQPanel>
      );
    }

    return (
      <section className="eq-grammar-test-card" aria-label="文法テスト問題">
        <div className="eq-grammar-test-topic">
          <span className="eq-grammar-test-emblem" aria-hidden="true">Grammar</span>
          <div>
            <p>学習テーマ</p>
            <h2>{lesson?.title || '文法'}</h2>
          </div>
          <div>
            <p>ターゲット</p>
            <strong>{grammarPoint || '文法ターゲット'}</strong>
          </div>
        </div>

        {question.questionJp ? <p className="eq-grammar-test-question">{question.questionJp}</p> : null}

        <div className="eq-grammar-test-choices">
          {question.choices.map((choice, choiceIndex) => (
            <EQChoiceButton
              key={`${question.quizId}-${choiceIndex}`}
              badge={String.fromCharCode(65 + choiceIndex)}
              className="eq-grammar-test-choice"
              selected={selectedIndex === choiceIndex && !answerResult}
              correct={Boolean(answerResult && choiceIndex === answerResult.correctIndex)}
              wrong={Boolean(answerResult && choiceIndex === selectedIndex && !answerResult.isCorrect)}
              disabled={Boolean(answerResult)}
              onClick={() => setSelectedIndex(choiceIndex)}
            >
              {choice}
            </EQChoiceButton>
          ))}
        </div>

        {!answerResult ? (
          <EQPrimaryButton
            type="button"
            disabled={selectedIndex === null || submitting}
            onClick={handleAnswer}
            className="eq-grammar-test-main-button"
            fullWidth
          >
            {submitting ? '判定中...' : 'こたえる'}
          </EQPrimaryButton>
        ) : (
          <div className={`eq-grammar-test-result ${answerResult.isCorrect ? 'is-correct' : 'is-wrong'}`}>
            <div className="eq-grammar-test-result-heading">
              <h2>{answerResult.isCorrect ? '正解！' : 'もう少し！'}</h2>
              <p>正解: {question.choices[answerResult.correctIndex]}</p>
            </div>
            {answerResult.explanationJp ? (
              <p className="eq-grammar-test-explanation">{answerResult.explanationJp}</p>
            ) : null}
            {!answerResult.isCorrect && selectedAnswerText ? (
              <p className="eq-grammar-test-selected-answer">選んだ答え: {selectedAnswerText}</p>
            ) : null}
            <EQPrimaryButton type="button" onClick={handleNext} className="eq-grammar-test-main-button" fullWidth>
              {isLast ? '結果を見る' : '次へ'}
            </EQPrimaryButton>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="eq-grammar-test-page">
      <EQMobileShell className="eq-grammar-test-screen">
        <CompactPageHeader
          title="文法テスト"
          backgroundImage={GRAMMAR_HERO_IMAGE}
          helperImage={SPIRIT_IMAGE}
          guidanceText="ルールをつかえたら合格！"
          metaItems={[
            `${currentCount} / ${questions.length || PRACTICE_QUESTION_LIMIT}`,
            `あと ${remainingToPass} 問`,
          ]}
          variant="grammar"
        />

        {renderBody()}
      </EQMobileShell>
      <EQBottomNav />
    </div>
  );
}
