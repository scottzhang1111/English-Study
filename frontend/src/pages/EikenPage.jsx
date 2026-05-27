import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import PetDisplay from '../components/PetDisplay';
import TtsButton from '../components/TtsButton';
import {
  EQBadge,
  EQBottomNav,
  EQInfoCard,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
  EQSecondaryButton,
} from '../components/eigo';
import { getEikenQuestions, submitPracticeAnswer, getReviewList } from '../api';

export default function EikenPage() {
  const childId = localStorage.getItem('selected_child_id') || '';
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [reviewList, setReviewList] = useState([]);
  const [reviewError, setReviewError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionSource, setQuestionSource] = useState('rule');
  const [sourceWarning, setSourceWarning] = useState('');
  const [importance, setImportance] = useState('ALL');
  const [frequency, setFrequency] = useState('ALL');
  const [earnedExp, setEarnedExp] = useState(0);
  const [petResult, setPetResult] = useState(null);

  const loadQuestions = ({ forceAi = false } = {}) => {
    setLoading(true);
    setError(null);
    getEikenQuestions({
      childId,
      forceAi,
      importance: importance === 'ALL' ? '' : importance,
      frequency: frequency === 'ALL' ? '' : frequency,
    })
      .then((data) => {
        setQuestions(data.questions || []);
        setQuestionSource(data.source || 'rule');
        setSourceWarning(data.warning || '');
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setFeedback('');
        setCorrectCount(0);
        setAnsweredCount(0);
        setEarnedExp(0);
        setPetResult(null);
      })
      .catch((err) => setError(err.message || '問題の読み込みに失敗しました。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const currentQuestion = questions[currentIndex];

  const handleSelect = async (choice) => {
    if (!currentQuestion || selectedAnswer) return;
    setSelectedAnswer(choice);
    try {
      const result = await submitPracticeAnswer({
        id: currentQuestion.id,
        word: currentQuestion.word,
        selected: choice,
        correct: currentQuestion.correct,
        childId,
      });

      setAnsweredCount((prev) => prev + 1);
      setEarnedExp(result.pet_exp_awarded || 0);
      setPetResult(result.pet || null);

      if (result.correct) {
        setCorrectCount((prev) => prev + 1);
        setFeedback('正解です。');
      } else {
        setFeedback(`正解は ${result.correct_answer} です。`);
      }
    } catch (err) {
      setFeedback(err.message);
    }
  };

  const loadReview = () => {
    setReviewError(null);
    getReviewList(childId)
      .then((data) => setReviewList(data.review_list || []))
      .catch((err) => setReviewError(err.message || '復習リストの読み込みに失敗しました。'));
  };

  const showNext = () => {
    setSelectedAnswer(null);
    setFeedback('');
    setPetResult(null);
    setEarnedExp(0);
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
  };

  const showPrev = () => {
    setSelectedAnswer(null);
    setFeedback('');
    setPetResult(null);
    setEarnedExp(0);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <EQPageHeader
          eyebrow="Eiken Quest"
          title="英検クエスト"
          subtitle="重要度と頻度を選んで問題に挑戦"
          icon="E"
        />

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <EQPanel title="絞り込み" tone="amber">
            <p className="eq-caption">重要度と出現頻度で問題を絞り込めます。</p>
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-black text-[var(--eq-text-sub)]">
                重要度
                <select
                  value={importance}
                  onChange={(event) => setImportance(event.target.value)}
                  className="rounded-full border border-[rgba(255,211,90,0.42)] bg-[rgba(7,9,31,0.68)] px-4 py-3 text-sm font-bold text-[var(--eq-text)]"
                >
                  <option value="ALL">すべて</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black text-[var(--eq-text-sub)]">
                出現頻度
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                  className="rounded-full border border-[rgba(255,211,90,0.42)] bg-[rgba(7,9,31,0.68)] px-4 py-3 text-sm font-bold text-[var(--eq-text)]"
                >
                  <option value="ALL">すべて</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <EQPrimaryButton type="button" onClick={() => loadQuestions()} fullWidth>
                適用
              </EQPrimaryButton>
            </div>
          </EQPanel>

          {loading ? (
            <EQPanel tone="cyan">
              <p className="eq-caption text-center">問題を読み込み中...</p>
            </EQPanel>
          ) : error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
              <EQPrimaryButton type="button" onClick={() => loadQuestions()} fullWidth>
                再読み込み
              </EQPrimaryButton>
            </EQPanel>
          ) : !currentQuestion ? (
            <EQPanel tone="gold">
              <p className="eq-caption text-center">出題できる問題がありません。</p>
            </EQPanel>
          ) : (
            <EQPanel title="Practice Question" eyebrow={`Question ${currentIndex + 1} / ${questions.length}`} tone="gold">
              <div className="flex flex-wrap gap-2">
                <EQBadge tone="cyan">{questionSource === 'ai' ? 'AI生成' : 'ルール生成'}</EQBadge>
                <EQBadge tone="gold">正解 {correctCount} / {answeredCount}</EQBadge>
              </div>

              <EQInfoCard
                title={currentQuestion.type || '問題'}
                value={currentQuestion.id ? `ID ${currentQuestion.id}` : ''}
                badges={sourceWarning ? <EQBadge tone="amber">Notice</EQBadge> : null}
                tone="amber"
              >
                {sourceWarning ? <p className="mb-3">{sourceWarning}</p> : null}
                <p className="whitespace-pre-line text-base font-bold leading-7">{currentQuestion.question}</p>
              </EQInfoCard>

              <div className="grid gap-3">
                {currentQuestion.choices.map((choice) => {
                  const isSelected = selectedAnswer === choice;
                  const isCorrect = choice === currentQuestion.correct;
                  const toneClass = selectedAnswer
                    ? isCorrect
                      ? 'is-correct'
                      : isSelected
                        ? 'is-wrong'
                        : ''
                    : '';

                  return (
                    <EQSecondaryButton
                      key={choice}
                      type="button"
                      onClick={() => handleSelect(choice)}
                      disabled={!!selectedAnswer}
                      fullWidth
                      className={`justify-start whitespace-normal text-left ${toneClass}`}
                    >
                      {choice}
                    </EQSecondaryButton>
                  );
                })}
              </div>

              {selectedAnswer && (
                <>
                  {feedback && (
                    <EQPanel tone={selectedAnswer === currentQuestion.correct ? 'green' : 'rose'}>
                      <p className="eq-caption">{feedback}</p>
                    </EQPanel>
                  )}

                  {petResult && (
                    <EQPanel tone="gold">
                      <PetDisplay pet={petResult} earnedExp={earnedExp} compact />
                    </EQPanel>
                  )}

                  <EQInfoCard title="解説" tone="cyan">
                    {currentQuestion.word && (
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-black text-[#fff0b5]">{currentQuestion.word}</p>
                        <TtsButton text={currentQuestion.word} label="Word" />
                      </div>
                    )}
                    {currentQuestion.japanese && (
                      <>
                        <p className="mt-3 font-black text-[#fff0b5]">日本語訳</p>
                        <p className="mt-2">{currentQuestion.japanese}</p>
                      </>
                    )}
                    {currentQuestion.example && (
                      <>
                        <p className="mt-3 font-black text-[#fff0b5]">英文例</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <p>{currentQuestion.example}</p>
                          <TtsButton text={currentQuestion.example} label="Example" />
                        </div>
                      </>
                    )}
                    {currentQuestion.example_jp && (
                      <>
                        <p className="mt-3 font-black text-[#fff0b5]">和訳例</p>
                        <p className="mt-2">{currentQuestion.example_jp}</p>
                      </>
                    )}
                    {currentQuestion.sentence_jp && (
                      <>
                        <p className="mt-3 font-black text-[#fff0b5]">例文</p>
                        <p className="mt-2">{currentQuestion.sentence_jp}</p>
                      </>
                    )}
                    {currentQuestion.explanation_jp && (
                      <>
                        <p className="mt-3 font-black text-[#fff0b5]">解説</p>
                        <p className="mt-2">{currentQuestion.explanation_jp}</p>
                      </>
                    )}
                  </EQInfoCard>
                </>
              )}

              <div className="grid gap-3">
                <EQSecondaryButton type="button" onClick={showPrev} disabled={currentIndex === 0} fullWidth>
                  前へ
                </EQSecondaryButton>
                <EQPrimaryButton type="button" onClick={showNext} disabled={currentIndex >= questions.length - 1} fullWidth>
                  次へ
                </EQPrimaryButton>
                <EQSecondaryButton type="button" onClick={loadReview} fullWidth>
                  復習リストを表示
                </EQSecondaryButton>
                <EQSecondaryButton type="button" onClick={() => loadQuestions({ forceAi: true })} fullWidth>
                  20問を再生成
                </EQSecondaryButton>
              </div>

              {reviewError && (
                <EQPanel title="復習リストエラー" tone="rose">
                  <p className="eq-caption">{reviewError}</p>
                </EQPanel>
              )}

              {reviewList.length > 0 && (
                <EQPanel title="復習リスト" tone="purple">
                  <div className="grid gap-3">
                    {reviewList.map((item) => (
                      <EQInfoCard
                        key={item.word_id}
                        title={item.word}
                        badges={<EQBadge tone="amber">誤答 {item.error_count}</EQBadge>}
                        tone="purple"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <p>{item.japanese}</p>
                          <TtsButton text={item.word} label="Word" />
                        </div>
                      </EQInfoCard>
                    ))}
                  </div>
                </EQPanel>
              )}
            </EQPanel>
          )}
        </motion.div>
      </EQMobileShell>
      <EQBottomNav />
    </div>
  );
}
