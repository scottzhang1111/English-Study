import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQBadge,
  EQBottomNav,
  EQChoiceButton,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';
import { getGrammarFormPractice, submitGrammarFormPracticeAnswer } from '../api';
import { createMissionReward } from '../helpers/eigoQuestRewards';

const CHILD_STORAGE_KEY = 'selected_child_id';
const PRACTICE_QUESTION_LIMIT = 5;

export default function GrammarFormPracticePage() {
  const navigate = useNavigate();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
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

  const loadPractice = () => {
    setLoading(true);
    setError('');
    setIndex(0);
    setSelectedIndex(null);
    setAnswerResult(null);
    setResults([]);
    getGrammarFormPractice({ childId, limit: PRACTICE_QUESTION_LIMIT })
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
  }, [childId, navigate]);

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
      createMissionReward({ childId });
      navigate('/card-reward');
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
      <EQPanel
        title={question.targetGrammar || `${question.title || '現在完了'}・経験`}
        eyebrow={`Question ${index + 1} / ${questions.length}`}
        tone="gold"
      >
        <div className="flex flex-wrap gap-2">
          <EQBadge tone="purple">{question.category || '文法'}</EQBadge>
          <EQBadge tone="cyan">合格まで {remainingToPass} 問</EQBadge>
        </div>

        {question.questionJp ? <p className="eq-caption">{question.questionJp}</p> : null}

        <EQPanel tone="cyan">
          <p className="text-xl font-black leading-8 text-[#fff0b5]">
            {question.promptEn || 'She ___ to Tokyo three times.'}
          </p>
        </EQPanel>

        <div className="grid gap-3">
          {question.choices.map((choice, choiceIndex) => (
            <EQChoiceButton
              key={`${question.testId}-${choice}`}
              badge={String.fromCharCode(65 + choiceIndex)}
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
            fullWidth
          >
            {submitting ? '判定中...' : 'こたえる'}
          </EQPrimaryButton>
        ) : (
          <EQPanel tone={answerResult.isCorrect ? 'green' : 'rose'}>
            <h2 className="m-0 text-xl font-black text-[#fff0b5]">
              {answerResult.isCorrect ? '正解！' : 'もう少し！'}
            </h2>
            <p className="eq-caption">答え: {answerResult.correctAnswer}</p>
            <p className="eq-caption">{answerResult.correctReasonJp}</p>
            {!answerResult.isCorrect && answerResult.selectedExplanationJp && (
              <p className="eq-caption">選んだ答え: {answerResult.selectedExplanationJp}</p>
            )}
            <EQPrimaryButton type="button" onClick={handleNext} fullWidth>
              {isLast ? (correctCount >= questions.length ? '報酬へ' : '結果を見る') : 'つぎへ'}
            </EQPrimaryButton>
          </EQPanel>
        )}
      </EQPanel>
    );
  };

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <EQPageHeader
          eyebrow="Grammar Test"
          title="文法テスト"
          subtitle="ルールをつかえたら合格！"
          icon="文"
          meta={
            <div className="flex flex-wrap gap-2">
              <EQBadge tone="gold">{questions.length && index < questions.length ? index + 1 : 0} / {questions.length || PRACTICE_QUESTION_LIMIT}</EQBadge>
              <EQBadge tone="cyan">合格まで {remainingToPass} 問</EQBadge>
            </div>
          }
        />

        {renderBody()}
      </EQMobileShell>
      <EQBottomNav />
    </div>
  );
}
