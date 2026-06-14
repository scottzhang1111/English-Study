import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChildren } from '../ChildrenContext';
import {
  EQ_ASSETS,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQHeroHeader,
  EQPageShell,
} from '../components/eigo';
import { getDailyReview, submitDailyReview } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';
const TARGET_COUNT = 10;

function speak(text) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function normalizeQuestion(question) {
  return {
    ...question,
    vocabId: question.vocabId || question.vocab_id,
    questionType: question.questionType || question.question_type || question.type || '',
    correctAnswer: question.correctAnswer || question.correct_answer || question.answer || '',
    audioText: question.audioText || question.audio_text || question.word || '',
    meaningJa: question.meaningJa || question.meaning_ja || '',
    exampleJa: question.exampleJa || question.example_ja || '',
    explanationJa: question.explanationJa || question.explanation_ja || '',
  };
}

export default function DailyReviewPage() {
  const navigate = useNavigate();
  const { selectedChildId: contextChildId } = useChildren();
  const childId = contextChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const [questions, setQuestions] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    getDailyReview(childId, TARGET_COUNT)
      .then((payload) => {
        if (!active) return;
        setQuestions((payload.questions || []).map(normalizeQuestion));
        setMessage(payload.message || '');
        setCurrentIndex(0);
        setSelectedAnswer('');
        setAnswers([]);
        setResult(null);
      })
      .catch((err) => {
        if (active) setError(err.message || '今日の冒険を読み込めませんでした');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [childId, navigate]);

  const currentQuestion = questions[currentIndex] || null;
  const answered = answers.find((item) => item.index === currentIndex) || null;
  const correctCount = useMemo(() => answers.filter((item) => item.is_correct).length, [answers]);
  const wrongCount = Math.max(0, answers.length - correctCount);

  function chooseAnswer(choice) {
    if (!currentQuestion || answered || result) return;
    const isCorrect = choice === currentQuestion.correctAnswer;
    setSelectedAnswer(choice);
    setAnswers((prev) => [
      ...prev.filter((item) => item.index !== currentIndex),
      {
        index: currentIndex,
        vocab_id: currentQuestion.vocabId,
        question_type: currentQuestion.questionType,
        selected_answer: choice,
        correct_answer: currentQuestion.correctAnswer,
        is_correct: isCorrect,
      },
    ]);
  }

  async function finishReview(nextAnswers = answers) {
    setSubmitting(true);
    setError('');
    try {
      const payload = await submitDailyReview(childId, nextAnswers.map(({ index, ...answer }) => answer));
      setResult(payload);
    } catch (err) {
      setError(err.message || '結果を保存できませんでした');
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (currentIndex >= questions.length - 1) {
      finishReview();
      return;
    }
    setCurrentIndex((index) => index + 1);
    setSelectedAnswer('');
  }

  function renderEmptyState() {
    return (
      <EQFantasyCard
        title="まだ復習できる単語がありません"
        subtitle="まずはメイン学習を進めましょう"
        iconImage={EQ_ASSETS.ui.wordBook}
      >
        <EQFantasyButton fullWidth onClick={() => navigate('/')}>
          ホームへ
        </EQFantasyButton>
      </EQFantasyCard>
    );
  }

  function renderResult() {
    const total = Number(result?.total || questions.length || 0);
    const correct = Number(result?.correct ?? correctCount);
    const wrong = Number(result?.wrong ?? Math.max(0, total - correct));
    return (
      <EQFantasyCard
        eyebrow="Daily Review"
        title="今日の冒険 完了！"
        subtitle={`正解：${correct} / ${total}`}
        iconImage={EQ_ASSETS.ui.coinIcon}
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <EQFantasyBadge icon="?">正解 {correct}</EQFantasyBadge>
            <EQFantasyBadge variant={wrong > 0 ? 'cyan' : 'green'} icon="!">まちがい {wrong}語</EQFantasyBadge>
          </div>
          <div className="grid gap-3">
            <EQFantasyButton fullWidth onClick={() => navigate('/')}>
              ホームへ
            </EQFantasyButton>
            {wrong > 0 ? (
              <EQFantasyButton fullWidth variant="dark" onClick={() => navigate('/review/words')}>
                まちがい復習へ
              </EQFantasyButton>
            ) : null}
          </div>
        </div>
      </EQFantasyCard>
    );
  }

  return (
    <EQPageShell withBottomNav bottomNavClassName="eq-learning-hub-bottom-nav">
      <EQHeroHeader
        title="今日の冒険"
        subtitle="前に覚えた単語をもう一度思い出そう"
        bgImage={EQ_ASSETS.bg.learningHub}
        elementLabel="泉"
        progressText={result ? 'CLEAR' : `${Math.min(currentIndex + 1, questions.length || TARGET_COUNT)} / ${questions.length || TARGET_COUNT}`}
      />

      {error ? (
        <div className="rounded-[18px] border border-rose-300/50 bg-rose-950/45 px-4 py-3 text-sm font-black text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <EQFantasyCard title="準備中" subtitle="今日の冒険を読み込んでいます" iconImage={EQ_ASSETS.ui.reviewGlass} />
      ) : result ? (
        renderResult()
      ) : questions.length === 0 ? (
        renderEmptyState()
      ) : currentQuestion ? (
        <EQFantasyCard
          eyebrow="Daily Review"
          title={`問題 ${currentIndex + 1} / ${questions.length}`}
          subtitle={currentQuestion.word || currentQuestion.meaningJa || message || ''}
          iconImage={EQ_ASSETS.ui.reviewGlass}
        >
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <EQFantasyBadge>Meaning</EQFantasyBadge>
              <EQFantasyBadge variant="cyan">英語 → 日本語</EQFantasyBadge>
            </div>

            <div className="rounded-[20px] border border-[rgba(255,211,90,0.32)] bg-[rgba(5,12,36,0.58)] p-4">
              <p className="mb-3 text-sm font-black text-slate-300">この英単語の意味を選ぼう</p>
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 min-w-0 break-words text-4xl font-black leading-tight text-[#fff8df]">
                  {currentQuestion.word || currentQuestion.audioText}
                </p>
                <EQFantasyButton variant="dark" trailingIcon="" onClick={() => speak(currentQuestion.audioText || currentQuestion.word)}>
                  音声
                </EQFantasyButton>
              </div>
            </div>

            <div className="grid gap-3">
              {(currentQuestion.choices || []).map((choice, index) => {
                const isSelected = selectedAnswer === choice || answered?.selected_answer === choice;
                const isCorrectChoice = answered && choice === currentQuestion.correctAnswer;
                const isWrongSelected = answered && isSelected && !answered.is_correct;
                return (
                  <button
                    key={`${choice}-${index}`}
                    type="button"
                    onClick={() => chooseAnswer(choice)}
                    disabled={Boolean(answered)}
                    className={[
                      'w-full rounded-[18px] border px-4 py-4 text-left text-base font-black transition',
                      'border-[rgba(255,211,90,0.5)] bg-[rgba(8,23,62,0.88)] text-slate-100',
                      isSelected ? 'ring-2 ring-[#ffe58f]' : '',
                      isCorrectChoice ? 'border-emerald-300 bg-emerald-900/55 text-emerald-100' : '',
                      isWrongSelected ? 'border-rose-300 bg-rose-900/55 text-rose-100' : '',
                    ].join(' ')}
                  >
                    <span className="mr-3 text-[#ffe58f]">({index + 1})</span>
                    {choice}
                  </button>
                );
              })}
            </div>

            {answered ? (
              <div className={`rounded-[18px] border px-4 py-3 text-sm font-black ${
                answered.is_correct
                  ? 'border-emerald-300/60 bg-emerald-950/45 text-emerald-100'
                  : 'border-rose-300/60 bg-rose-950/45 text-rose-100'
              }`}
              >
                {answered.is_correct ? '正解です！' : `正解：${currentQuestion.correctAnswer}`}
              </div>
            ) : null}

            <EQFantasyButton fullWidth onClick={goNext} disabled={!answered || submitting}>
              {currentIndex >= questions.length - 1 ? '結果を見る' : '次へ'}
            </EQFantasyButton>
          </div>
        </EQFantasyCard>
      ) : null}
    </EQPageShell>
  );
}
