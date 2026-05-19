import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WebLearningLayout from '../components/WebLearningLayout';
import { getGrammarFormPractice, submitGrammarFormPracticeAnswer } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function optionClass({ index, selectedIndex, result }) {
  if (!result) {
    return selectedIndex === index
      ? 'border-[#ffc940] bg-[#fff7d6] text-[#59430c]'
      : 'border-white/90 bg-white/88 text-[#354172] hover:-translate-y-0.5 hover:bg-white';
  }
  if (index === result.correctIndex) return 'border-[#68c783] bg-[#eefbf1] text-[#2f6b42]';
  if (index === selectedIndex && !result.isCorrect) return 'border-[#ff9baa] bg-[#fff0f2] text-[#a94354]';
  return 'border-white/80 bg-white/68 text-[#7d8aa9]';
}

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

  const loadPractice = () => {
    setLoading(true);
    setError('');
    setIndex(0);
    setSelectedIndex(null);
    setAnswerResult(null);
    setResults([]);
    getGrammarFormPractice({ childId, limit: 5 })
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
    setIndex(questions.length);
  };

  if (loading) {
    return (
      <WebLearningLayout title="文法練習" subtitle="ランダム練習">
        <div className="panel p-6 text-center font-bold text-[#6f7da8]">練習問題を準備しています...</div>
      </WebLearningLayout>
    );
  }

  return (
    <WebLearningLayout title="文法練習" subtitle="ランダム練習">
      <section className="rounded-[34px] border border-white/90 bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-5 shadow-[0_18px_44px_rgba(145,177,209,0.16)] sm:p-7">
        <div className="rounded-[28px] bg-white/82 p-5">
          <p className="text-xs font-black text-[#8fa0c2]">拡張練習</p>
          <h1 className="display-font mt-1 text-3xl font-black text-[#31406f]">学んだ文法から5問</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-[#60709d]">
            これまで学習した文法だけからランダムに出題します。まちがえた問題は復習リストに入ります。
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-[24px] bg-rose-50 p-5 text-sm font-bold leading-7 text-rose-700">
            {error}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate('/grammar')} className="pill-button px-5 py-3">
                文法レッスンへ
              </button>
              <button type="button" onClick={loadPractice} className="ghost-button px-5 py-3">
                もう一度読み込む
              </button>
            </div>
          </div>
        ) : !questions.length ? (
          <div className="mt-5 rounded-[24px] bg-white/76 p-5 text-sm font-bold text-[#6f7da8]">
            まだ練習できる文法がありません。まず文法レッスンを学びましょう。
          </div>
        ) : index >= questions.length ? (
          <div className="mt-5 rounded-[28px] bg-white/82 p-6 text-center">
            <h2 className="display-font text-3xl font-black text-[#31406f]">練習おつかれさま！</h2>
            <p className="mt-3 text-sm font-bold text-[#60709d]">
              正解 {correctCount} / {questions.length} 問
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={loadPractice} className="pill-button px-5 py-3">
                もう5問
              </button>
              <button type="button" onClick={() => navigate('/review')} className="ghost-button px-5 py-3">
                復習リストへ
              </button>
            </div>
          </div>
        ) : (
          <article className="mt-5 rounded-[28px] bg-white/82 p-5 shadow-[0_12px_30px_rgba(145,177,209,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#51688f]">
                  {question.category} / {question.title}
                </span>
                <h2 className="display-font mt-3 text-2xl font-black text-[#31406f]">
                  {index + 1} / {questions.length}
                </h2>
              </div>
              <span className="rounded-full bg-[#fff7d6] px-4 py-2 text-xs font-black text-[#6b5a2d]">
                {question.targetGrammar}
              </span>
            </div>

            <p className="mt-5 text-base font-black leading-7 text-[#354172]">{question.questionJp}</p>
            <p className="mt-4 rounded-[22px] bg-[#f8fbff] px-5 py-4 text-xl font-black leading-8 text-[#31406f]">
              {question.promptEn}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {question.choices.map((choice, choiceIndex) => (
                <button
                  key={`${question.testId}-${choice}`}
                  type="button"
                  disabled={Boolean(answerResult)}
                  onClick={() => setSelectedIndex(choiceIndex)}
                  className={`flex min-h-[76px] items-center gap-3 rounded-[22px] border-2 px-4 py-3 text-left text-base font-bold transition ${optionClass({
                    index: choiceIndex,
                    selectedIndex,
                    result: answerResult,
                  })}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/86 text-xs font-black">
                    {String.fromCharCode(65 + choiceIndex)}
                  </span>
                  <span>{choice}</span>
                </button>
              ))}
            </div>

            {!answerResult ? (
              <button
                type="button"
                disabled={selectedIndex === null || submitting}
                onClick={handleAnswer}
                className="pill-button mt-5 w-full px-6 py-4 text-base disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? '保存中...' : '答える'}
              </button>
            ) : (
              <div className="mt-5 space-y-3">
                <div className={`rounded-[24px] p-4 ${answerResult.isCorrect ? 'bg-[#eefbf1] text-[#2f6b42]' : 'bg-[#fff0f2] text-[#a94354]'}`}>
                  <p className="text-lg font-black">{answerResult.isCorrect ? 'よくできました！' : 'ここを覚えれば大丈夫'}</p>
                  <p className="mt-2 text-sm font-bold leading-6">
                    答え: {answerResult.correctAnswer}
                  </p>
                  <p className="mt-2 text-sm font-bold leading-6">{answerResult.correctReasonJp}</p>
                  {!answerResult.isCorrect && answerResult.selectedExplanationJp && (
                    <p className="mt-2 text-sm font-bold leading-6">選んだ答え: {answerResult.selectedExplanationJp}</p>
                  )}
                </div>
                <button type="button" onClick={handleNext} className="pill-button px-5 py-3">
                  {isLast ? '結果を見る' : '次の問題へ'}
                </button>
              </div>
            )}
          </article>
        )}
      </section>
    </WebLearningLayout>
  );
}
