import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import PetDisplay from '../components/PetDisplay';
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
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="Practice Set" />

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="panel flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#6f7da8]">絞り込み</p>
            <p className="text-xs leading-6 text-[#8a96b8]">重要度と出現頻度で問題を絞り込めます。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex items-center gap-2 text-sm font-bold text-[#354172]">
              重要度
              <select
                value={importance}
                onChange={(event) => setImportance(event.target.value)}
                className="rounded-full border border-white/80 bg-[#f8fcff] px-4 py-2 text-sm font-bold text-[#354172]"
              >
                <option value="ALL">すべて</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-[#354172]">
              出現頻度
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value)}
                className="rounded-full border border-white/80 bg-[#f8fcff] px-4 py-2 text-sm font-bold text-[#354172]"
              >
                <option value="ALL">すべて</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <button type="button" onClick={() => loadQuestions()} className="pill-button px-5 py-3 text-sm">
              適用
            </button>
          </div>
        </div>

        {loading ? (
          <div className="panel p-6 text-center text-[#6f7da8]">問題を読み込み中...</div>
        ) : error ? (
          <div className="panel p-6 text-center text-rose-700">
            <p>{error}</p>
            <button type="button" onClick={() => loadQuestions()} className="pill-button mt-4 px-5 py-3 text-sm">
              再読み込み
            </button>
          </div>
        ) : !currentQuestion ? (
          <div className="panel p-6 text-center text-[#6f7da8]">出題できる問題がありません。</div>
        ) : (
          <div className="panel p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#6f7da8]">
                  Question {currentIndex + 1} / {questions.length}
                </p>
                <h2 className="display-font mt-2 text-3xl font-extrabold text-[#354172]">Practice Question</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full bg-[#e8f5ff] px-4 py-2 text-sm font-bold text-[#6176aa]">
                  {questionSource === 'ai' ? 'AI生成' : 'ルール生成'}
                </div>
                <div className="rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-bold text-[#69557e]">
                  正解 {correctCount} / {answeredCount}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] bg-[linear-gradient(180deg,#eef8ff_0%,#e3f3ff_100%)] p-5">
              {sourceWarning && (
                <div className="mb-4 rounded-[20px] bg-[#fff8d9] px-4 py-3 text-sm font-bold leading-6 text-[#75622c]">
                  {sourceWarning}
                </div>
              )}
              <div className="mb-3 flex items-center gap-3">
                <span className="inline-block rounded-full bg-[#ffd253] px-3 py-1 text-xs font-bold text-[#5d4d77]">
                  {currentQuestion.type || '問題'}
                </span>
                {currentQuestion.id && (
                  <span className="inline-block rounded-full bg-[#e8f5ff] px-3 py-1 text-xs font-bold text-[#6176aa]">
                    ID {currentQuestion.id}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-line text-lg font-semibold leading-8 text-[#32416f]">
                {currentQuestion.question}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {currentQuestion.choices.map((choice) => {
                const isSelected = selectedAnswer === choice;
                const isCorrect = choice === currentQuestion.correct;
                const style = selectedAnswer
                  ? isCorrect
                    ? 'border-[#ffd253] bg-[#fff4bf] text-[#5d4d77]'
                    : isSelected
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-white/70 bg-white/70 text-[#32416f]'
                  : 'border-white/70 bg-white/82 text-[#32416f] hover:bg-[#f7fbff]';

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => handleSelect(choice)}
                    disabled={!!selectedAnswer}
                    className={`rounded-[24px] border px-4 py-4 text-left font-bold transition ${style}`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            {selectedAnswer && (
              <>
                {feedback && (
                  <div className="mt-5 rounded-[24px] bg-[#f8fbff] p-4 text-sm leading-7 text-[#61719e]">
                    {feedback}
                  </div>
                )}

                {petResult && (
                  <div className="mt-5">
                    <PetDisplay pet={petResult} earnedExp={earnedExp} compact />
                  </div>
                )}

                <div className="mt-5 rounded-[24px] bg-white/72 p-5 text-sm leading-7 text-[#5f6f9a]">
                  {currentQuestion.japanese && (
                    <>
                      <p className="font-bold text-[#354172]">日本語訳</p>
                      <p className="mt-2">{currentQuestion.japanese}</p>
                    </>
                  )}
                  {currentQuestion.example && (
                    <>
                      <p className="mt-3 font-bold text-[#354172]">英文例</p>
                      <p className="mt-2">{currentQuestion.example}</p>
                    </>
                  )}
                  {currentQuestion.example_jp && (
                    <>
                      <p className="mt-3 font-bold text-[#354172]">和訳例</p>
                      <p className="mt-2">{currentQuestion.example_jp}</p>
                    </>
                  )}
                  {currentQuestion.sentence_jp && (
                    <>
                      <p className="mt-3 font-bold text-[#354172]">例文</p>
                      <p className="mt-2">{currentQuestion.sentence_jp}</p>
                    </>
                  )}
                  {currentQuestion.explanation_jp && (
                    <>
                      <p className="mt-3 font-bold text-[#354172]">解説</p>
                      <p className="mt-2 text-[#69557e]">{currentQuestion.explanation_jp}</p>
                    </>
                  )}
                </div>
              </>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={showPrev}
                  disabled={currentIndex === 0}
                  className="ghost-button px-5 py-3 disabled:opacity-40"
                >
                  前へ
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  disabled={currentIndex >= questions.length - 1}
                  className="pill-button px-5 py-3 disabled:opacity-40"
                >
                  次へ
                </button>
                <button type="button" onClick={loadReview} className="ghost-button px-5 py-3">
                  復習リストを表示
                </button>
              </div>
              <button type="button" onClick={() => loadQuestions({ forceAi: true })} className="ghost-button px-5 py-3">
                20問を再生成
              </button>
            </div>

            {reviewError && <div className="mt-4 rounded-[24px] bg-rose-50 p-4 text-sm text-rose-700">{reviewError}</div>}

            {reviewList.length > 0 && (
              <div className="mt-5 rounded-[24px] bg-white/78 p-5">
                <h3 className="display-font text-2xl font-extrabold text-[#354172]">復習リスト</h3>
                <ul className="mt-3 space-y-3 text-sm leading-7 text-[#5f6f9a]">
                  {reviewList.map((item) => (
                    <li key={item.word_id} className="rounded-[20px] bg-[#f6fbff] p-4">
                      <span className="font-bold text-[#354172]">{item.word}</span>
                      {' '}
                      - {item.japanese} - 誤答回数 {item.error_count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
