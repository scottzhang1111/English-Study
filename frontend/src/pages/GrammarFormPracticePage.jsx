import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  EQBottomNav,
  EQChoiceButton,
  EQMobileShell,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';
import { getGrammarFormPractice, submitGrammarFormPracticeAnswer } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';
const PRACTICE_QUESTION_LIMIT = 5;

export default function GrammarFormPracticePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const lessonId = searchParams.get('lessonId') || '';
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const question = questions[index] || null;
  const isLast = index >= questions.length - 1;
  const correctCount = results.filter((item) => item.isCorrect).length;
  const passTarget = Math.min(questions.length || PRACTICE_QUESTION_LIMIT, PRACTICE_QUESTION_LIMIT);
  const remainingToPass = Math.max(0, passTarget - correctCount);
  const currentCount = questions.length && index < questions.length ? index + 1 : 0;

  const loadPractice = () => {
    setLoading(true);
    setError('');
    setIndex(0);
    setSelectedIndex(null);
    setAnswerResult(null);
    setResults([]);
    if (!lessonId) {
      setQuestions([]);
      setError('文法レッスンからテストへ進んでください。');
      setLoading(false);
      return;
    }
    getGrammarFormPractice({ childId, lessonId, limit: PRACTICE_QUESTION_LIMIT })
      .then((payload) => setQuestions(payload.questions || []))
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
    submitGrammarFormPracticeAnswer({ childId, testId: question.testId, selectedIndex })
      .then((payload) => {
        setAnswerResult(payload);
        setResults((items) => [...items, payload]);
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
    if (correctCount >= questions.length) {
      navigate('/grammar');
      return;
    }
    setIndex(questions.length);
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
      return (
        <EQPanel title="結果" tone="gold">
          <div className="flex flex-wrap gap-2">
            <EQBadge tone="gold">正解 {correctCount} / {questions.length}</EQBadge>
            <EQBadge tone={remainingToPass === 0 ? 'green' : 'rose'}>
              合格まで {remainingToPass} 問
            </EQBadge>
          </div>
          <p className="eq-caption">まちがえた問題は復習リストで確認できます。</p>
          <div className="grid gap-3">
            <EQPrimaryButton type="button" onClick={loadPractice} fullWidth>
              もう一度
            </EQPrimaryButton>
            <EQPrimaryButton type="button" onClick={() => navigate('/review')} fullWidth>
              復習へ
            </EQPrimaryButton>
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
            <h2>{question.title || question.category || '文法'}</h2>
          </div>
          <div>
            <p>ターゲット</p>
            <strong>{question.targetGrammar || '文法ターゲット'}</strong>
          </div>
        </div>

        {question.questionJp ? <p className="eq-grammar-test-question">{question.questionJp}</p> : null}

        <div className="eq-grammar-test-sentence">
          <p>
            {question.promptEn || 'She ___ to Tokyo three times.'}
          </p>
        </div>

        <div className="eq-grammar-test-choices">
          {question.choices.map((choice, choiceIndex) => (
            <EQChoiceButton
              key={`${question.testId}-${choice}`}
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
            <h2>
              {answerResult.isCorrect ? '正解！' : 'もう少し！'}
            </h2>
            <p>答え: {answerResult.correctAnswer}</p>
            <p>{answerResult.correctReasonJp}</p>
            {!answerResult.isCorrect && answerResult.selectedExplanationJp && (
              <p>選んだ答え: {answerResult.selectedExplanationJp}</p>
            )}
            <EQPrimaryButton type="button" onClick={handleNext} className="eq-grammar-test-main-button" fullWidth>
              {isLast ? (correctCount >= questions.length ? '完了' : '結果を見る') : '次へ'}
            </EQPrimaryButton>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="eq-grammar-test-page">
      <EQMobileShell className="eq-grammar-test-screen">
        <header className="eq-grammar-test-hero">
          <div>
            <h1>文法テスト</h1>
            <p>ルールをつかえたら合格！</p>
            <div className="eq-grammar-test-meter">
              <span>{currentCount} / {questions.length || PRACTICE_QUESTION_LIMIT}</span>
              <strong>合格まであと {remainingToPass} 問</strong>
            </div>
          </div>
          <img src="/assets/eigo-quest/spirit_assets/happy.png" alt="" aria-hidden="true" />
        </header>

        {renderBody()}
      </EQMobileShell>
      <EQBottomNav />
    </div>
  );
}
