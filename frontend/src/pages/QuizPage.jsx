import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import { getQuizData, submitPracticeAnswer } from '../api';

export default function QuizPage() {
  const [history, setHistory] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const currentQuiz = history[currentIndex] || null;
  const masteredCount = currentQuiz?.mastered_count ?? 0;
  const errorCount = currentQuiz?.error_count ?? 0;
  const isInitialLoading = loading && !currentQuiz;
  const hasNoReviewWords = currentQuiz && currentQuiz.choices.length === 0;
  const pageText = currentQuiz ? `${currentIndex + 1} / ${history.length}` : '- / -';

  const fetchQuiz = async ({ word } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const quizData = await getQuizData({ word });
      setHistory((prev) => {
        const base = currentIndex >= 0 && currentIndex < prev.length - 1 ? prev.slice(0, currentIndex + 1) : prev;
        setCurrentIndex(base.length);
        return [...base, quizData];
      });
      setAnswer(null);
      setResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuiz();
  }, []);

  const openCard = () => {
    const word = currentQuiz?.word || currentQuiz?.correct;
    navigate(word ? `/flashcard?word=${encodeURIComponent(word)}` : '/flashcard');
  };

  const handleSelection = async (choice) => {
    if (!currentQuiz || answer || !currentQuiz.correct) return;
    setAnswer(choice);
    const childId = localStorage.getItem('selected_child_id') || '';
    try {
      const payload = await submitPracticeAnswer({
        id: currentQuiz.id,
        word: currentQuiz.word,
        selected: choice,
        correct: currentQuiz.correct,
        childId,
      });
      setResult(payload);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswer(null);
      setResult(null);
    }
  };

  const handleNext = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer(null);
      setResult(null);
      return;
    }
    fetchQuiz();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="ミニ練習" />

      {error ? (
        <div className="panel px-5 py-5 text-sm text-rose-700">{error}</div>
      ) : (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="panel px-6 py-6 sm:px-8">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#e0f2ff_100%)] p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/82 px-4 py-2 text-xs font-black text-[#6176aa]">
                覚えた単語 {masteredCount}
              </span>
              <span className="rounded-full bg-[#fff2bb] px-4 py-2 text-xs font-black text-[#69557e]">
                まちがい {errorCount}
              </span>
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#6f7da8]">復習テスト</p>
            <h2 className="display-font mt-4 text-3xl font-extrabold leading-tight text-[#354172] sm:text-4xl">
              {isInitialLoading
                ? '復習できる単語を確認しています...'
                : hasNoReviewWords
                  ? 'まだ復習できる単語がありません。まず単語カードで覚えましょう。'
                  : currentQuiz?.question || '問題を読み込み中...'}
            </h2>
            <p className="mt-3 text-sm font-bold leading-6 text-[#6f7da8]">
              覚えた単語から出題します。まちがいが多い単語ほど出やすくなります。
            </p>
          </div>

          {isInitialLoading ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-5 text-center text-sm font-bold leading-7 text-[#60709d]">
              少し待ってね。復習リストを作っています。
            </div>
          ) : hasNoReviewWords ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-5 text-center text-sm font-bold leading-7 text-[#60709d]">
              まだ復習できる単語がありません。単語カードで単語を覚えてから、もう一度ためしましょう。
              <div className="mt-4">
                <button type="button" onClick={openCard} className="pill-button px-6 py-3">
                  単語カードへ
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4">
                {currentQuiz?.choices.map((choice) => {
                  const isCorrect = answer && choice === currentQuiz.correct;
                  const isWrong = answer && choice === answer && choice !== currentQuiz.correct;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => handleSelection(choice)}
                      disabled={!!answer}
                      className={`rounded-[24px] border px-5 py-4 text-left text-lg font-bold transition ${
                        isCorrect
                          ? 'border-[#ffcf48] bg-[#fff4bf] text-[#5e4e76]'
                          : isWrong
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-white/80 bg-white/78 text-[#34406f] hover:bg-[#f6fbff]'
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              {answer && currentQuiz && (
                <div className="mt-5 rounded-[24px] bg-[#f9fcff] p-5 text-sm leading-7 text-[#60709d]">
                  <p className="text-base font-black text-[#354172]">
                    {answer === currentQuiz.correct ? 'せいかい！' : `こたえ: ${currentQuiz.correct}`}
                  </p>
                  {currentQuiz.japanese && <p className="mt-2">意味: {currentQuiz.japanese}</p>}
                  {currentQuiz.example && <p className="mt-2">使い方: {currentQuiz.example}</p>}
                  {currentQuiz.example_jp && <p className="mt-2">例文の意味: {currentQuiz.example_jp}</p>}
                  {result?.pet_exp_awarded > 0 && (
                    <p className="mt-2 font-bold text-[#6b5a2d]">ポケモン EXP +{result.pet_exp_awarded}</p>
                  )}
                  {answer !== currentQuiz.correct && (
                    <button type="button" onClick={openCard} className="ghost-button mt-4 px-5 py-3">
                      カードで意味・使い方・発音を見る
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0 || loading}
              className="ghost-button px-5 py-3 disabled:opacity-40"
            >
              前へ
            </button>
            <div className="text-sm font-bold text-[#7280a8]">{pageText}</div>
            <button
              type="button"
              onClick={handleNext}
              disabled={loading || !currentQuiz?.correct}
              className="pill-button px-5 py-3 disabled:opacity-40"
            >
              {loading ? '読み込み中...' : '次の問題'}
            </button>
          </div>
        </motion.section>
      )}
    </div>
  );
}
