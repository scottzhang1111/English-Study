import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import TtsButton from '../components/TtsButton';
import WebLearningLayout from '../components/WebLearningLayout';
import WrongQuestionCard from '../components/WrongQuestionCard';
import {
  getBattleWrongQuestions,
  getEikenPre2WrongQuestions,
  getGrammarFormWrongQuestions,
  getReviewList,
  masterBattleWrongQuestion,
  masterGrammarFormWrongQuestion,
  submitPracticeAnswer,
} from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

export default function ReviewPage() {
  const [reviewList, setReviewList] = useState([]);
  const [battleWrongList, setBattleWrongList] = useState([]);
  const [grammarFormWrongList, setGrammarFormWrongList] = useState([]);
  const [eikenWrongList, setEikenWrongList] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem(CHILD_STORAGE_KEY) || '');
  const [selectedWord, setSelectedWord] = useState(null);
  const [stage, setStage] = useState('list');
  const [quiz, setQuiz] = useState(null);
  const [answer, setAnswer] = useState('');
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const totalReviewCount = reviewList.length + battleWrongList.length + grammarFormWrongList.length + eikenWrongList.length;
  const rightPanel = (
    <div className="rounded-3xl border border-white/80 bg-white/86 p-5 shadow-[0_16px_36px_rgba(129,164,199,0.14)] backdrop-blur">
      <p className="text-xs font-bold text-[#8fa0c2]">復習ステータス</p>
      <h2 className="mt-2 text-2xl font-bold text-[#31406f]">{totalReviewCount} 件</h2>
      <div className="mt-5 grid gap-3 text-sm font-bold text-[#60709d]">
        <div className="rounded-2xl bg-[#f8fcff] p-3">単語: {reviewList.length}</div>
        <div className="rounded-2xl bg-[#fff8d9] p-3">文法: {grammarFormWrongList.length}</div>
        <div className="rounded-2xl bg-[#f8fcff] p-3">英検: {eikenWrongList.length}</div>
      </div>
      <Link to="/flashcard" className="pill-button mt-5 block px-4 py-3 text-center text-sm">単語を学ぶ</Link>
    </div>
  );

  useEffect(() => {
    const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
    setSelectedChildId(childId);
    setLoading(true);
    Promise.allSettled([
      getReviewList(childId),
      getBattleWrongQuestions(childId),
      getGrammarFormWrongQuestions(childId),
      getEikenPre2WrongQuestions({ childId, latestOnly: true, limit: 6 }),
    ])
      .then(([reviewResult, battleResult, grammarFormResult, eikenResult]) => {
        const failed = [reviewResult, battleResult, grammarFormResult, eikenResult].filter((result) => result.status === 'rejected');

        setReviewList(reviewResult.status === 'fulfilled' ? reviewResult.value.review_list || [] : []);
        setBattleWrongList(battleResult.status === 'fulfilled' ? battleResult.value.wrongQuestions || [] : []);
        setGrammarFormWrongList(grammarFormResult.status === 'fulfilled' ? grammarFormResult.value.wrongQuestions || [] : []);
        setEikenWrongList(eikenResult.status === 'fulfilled' ? eikenResult.value.wrong_questions || [] : []);

        if (failed.length === 4) {
          throw new Error(failed[0].reason?.message || '復習リストを読み込めませんでした。');
        }
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleMasterBattleWrong = (wrongId) => {
    masterBattleWrongQuestion(wrongId)
      .then(() => setBattleWrongList((items) => items.filter((item) => item.wrongId !== wrongId)))
      .catch((err) => setError(err.message));
  };

  const handleMasterGrammarFormWrong = (testId) => {
    const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
    masterGrammarFormWrongQuestion({ childId, testId })
      .then(() => setGrammarFormWrongList((items) => items.filter((item) => item.testId !== testId)))
      .catch((err) => setError(err.message));
  };

  const buildWrongWordQuiz = (wordItem) => {
    const distractors = reviewList
      .filter((item) => String(item.word_id) !== String(wordItem.word_id))
      .map((item) => item.word)
      .filter(Boolean)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const choices = [wordItem.word, ...distractors].sort(() => Math.random() - 0.5);
    return {
      id: wordItem.word_id || wordItem.id,
      word: wordItem.word,
      correct: wordItem.word,
      choices,
      question: wordItem.example
        ? wordItem.example.replace(new RegExp(`\\b${String(wordItem.word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '____')
        : `「${wordItem.japanese}」は英語でどれ？`,
    };
  };

  const openReviewWord = (item) => {
    setSelectedWord(item);
    setQuiz(null);
    setAnswer('');
    setQuizResult(null);
    setStage('detail');
  };

  const startWrongQuiz = () => {
    if (!selectedWord) return;
    setQuiz(buildWrongWordQuiz(selectedWord));
    setAnswer('');
    setQuizResult(null);
    setStage('quiz');
  };

  const handleQuizAnswer = async (choice) => {
    if (!quiz || answer) return;
    setAnswer(choice);
    try {
      const payload = await submitPracticeAnswer({
        id: selectedWord.word_id || selectedWord.id,
        word: selectedWord.word,
        selected: choice,
        correct: quiz.correct,
        childId: localStorage.getItem(CHILD_STORAGE_KEY) || '',
      });
      setQuizResult(payload);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <WebLearningLayout title="復習リスト" subtitle="まちがえた問題を確認" rightPanel={rightPanel}>
      <HeaderBar subtitle="復習リスト" />
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="panel px-6 py-6 sm:px-8">
        <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef8ff_0%,#e3f3ff_100%)] p-6">
          <h2 className="display-font text-3xl font-extrabold text-[#354172]">まちがえた問題を見なおそう</h2>
          <p className="mt-3 text-sm leading-6 text-[#6f7da8]">文法バトルと単語練習のまちがいを、やさしく復習できます。</p>
        </div>

        {!loading && !error && totalReviewCount === 0 && (
          <div className="mt-5 rounded-[28px] bg-white/76 p-8 text-center text-[#6f7da8]">
            <h3 className="text-2xl font-bold text-[#31406f]">まだ復習する問題はありません。</h3>
            <p className="mt-2 text-base font-bold">よくできました！</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/" className="ghost-button px-5 py-3">ホームに戻る</Link>
              <Link to="/flashcard" className="pill-button px-5 py-3">単語を学ぶ</Link>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-5 rounded-[24px] bg-white/70 p-6 text-center text-[#6f7da8]">復習リストを読み込み中...</div>
        ) : error ? (
          <div className="mt-5 rounded-[24px] bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
        ) : totalReviewCount === 0 && false ? (
          <div className="mt-5 rounded-[24px] bg-white/70 p-6 text-center text-[#6f7da8]">まだ復習する問題はありません。</div>
        ) : stage === 'detail' && selectedWord ? (
          <div className="mt-5 rounded-[28px] bg-white/82 p-5 shadow-[0_16px_36px_rgba(145,177,209,0.12)]">
            <button type="button" onClick={() => setStage('list')} className="ghost-button px-4 py-2 text-sm">一覧へ戻る</button>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="display-font text-4xl font-extrabold text-[#354172]">{selectedWord.word}</p>
                  <TtsButton text={selectedWord.word} label="単語" />
                </div>
                <p className="mt-2 text-lg font-bold text-[#6f7da8]">{selectedWord.japanese}</p>
              </div>
              <div className="inline-flex rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-black text-[#69557e]">
                間違えた回数: {selectedWord.error_count}
              </div>
            </div>
            {selectedWord.example && (
              <div className="mt-5 rounded-[22px] bg-[#f8fbff] px-5 py-4 text-sm font-bold leading-7 text-[#60709d]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p>例文: {selectedWord.example}</p>
                  <TtsButton text={selectedWord.example} label="例文" />
                </div>
              </div>
            )}
            {(selectedWord.example_japanese || selectedWord.sentence_jp) && (
              <p className="mt-3 rounded-[22px] bg-[#fffdf7] px-5 py-4 text-sm font-bold leading-7 text-[#60709d]">
                意味: {selectedWord.example_japanese || selectedWord.sentence_jp}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={startWrongQuiz} className="pill-button px-5 py-3">この問題をやり直す</button>
            </div>
          </div>
        ) : stage === 'quiz' && selectedWord && quiz ? (
          <div className="mt-5 rounded-[28px] bg-white/82 p-5 shadow-[0_16px_36px_rgba(145,177,209,0.12)]">
            <p className="text-sm font-black text-[#6f7da8]">まちがい直し</p>
            <h2 className="display-font mt-3 text-3xl font-extrabold leading-tight text-[#354172]">{quiz.question}</h2>
            {quiz.choices.length < 2 ? (
              <div className="mt-5 rounded-[24px] bg-[#f8fbff] p-5 text-sm font-bold text-[#60709d]">選択肢を作るには、まちがえた単語がもう少し必要です。</div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {quiz.choices.map((choice) => {
                  const isCorrect = answer && choice === quiz.correct;
                  const isWrong = answer === choice && choice !== quiz.correct;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => handleQuizAnswer(choice)}
                      disabled={!!answer}
                      className={`rounded-[24px] border px-5 py-4 text-left text-lg font-bold transition ${
                        isCorrect ? 'border-[#ffcf48] bg-[#fff4bf] text-[#5e4e76]' : isWrong ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-white/80 bg-white/78 text-[#34406f] hover:bg-[#f6fbff]'
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}
            {answer && (
              <div className="mt-5 rounded-[24px] bg-[#f9fcff] p-5 text-sm font-bold leading-7 text-[#60709d]">
                <p className="text-base font-black text-[#354172]">{answer === quiz.correct ? 'せいかい！' : `こたえ: ${quiz.correct}`}</p>
                {quizResult?.pet_exp_awarded > 0 && <p className="mt-2 text-[#6b5a2d]">ペット EXP +{quizResult.pet_exp_awarded}</p>}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={startWrongQuiz} className="ghost-button px-5 py-3">もう一度</button>
                  <button type="button" onClick={() => setStage('list')} className="pill-button px-5 py-3">一覧へ戻る</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <section className="rounded-[28px] bg-[#eef8ff] p-4">
              <h3 className="display-font text-xl font-extrabold text-[#354172]">単語のまちがい</h3>
              <p className="mt-1 text-sm font-bold text-[#6f7da8]">間違えた単語を選んで、もう一度学習してから問題をやり直しましょう。</p>
              <div className="mt-4 grid gap-3">
                {reviewList.map((item) => (
                  <article
                    key={item.word_id}
                    className="rounded-[24px] bg-white/88 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.10)] transition hover:-translate-y-0.5 hover:bg-[#f8fcff]"
                  >
                    <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <span className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => openReviewWord(item)} className="text-left">
                            <span className="display-font block text-2xl font-extrabold text-[#354172]">{item.word}</span>
                          </button>
                          <TtsButton text={item.word} label="Word" />
                        </span>
                        <span className="mt-1 block text-sm font-bold text-[#6f7da8]">{item.japanese}</span>
                      </span>
                      <span className="inline-flex rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-black text-[#69557e]">
                        間違えた回数: {item.error_count}
                      </span>
                    </span>
                  </article>
                ))}
              </div>
            </section>
            {battleWrongList.length > 0 && (
              <section className="rounded-[28px] bg-[#eef8ff] p-4">
                <h3 className="display-font text-xl font-extrabold text-[#354172]">文法バトルのまちがい</h3>
                <p className="mt-1 text-sm font-bold text-[#6f7da8]">答えられたら「できた！」にしよう。少しEXPも入ります。</p>
                <div className="mt-4 space-y-3">
                  {battleWrongList.map((item) => (
                    <article key={item.wrongId} className="rounded-[24px] bg-white/88 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.10)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <span className="rounded-full bg-[#fff8d9] px-3 py-1 text-xs font-black text-[#6b5a2d]">{item.category}</span>
                          <p className="mt-3 text-base font-extrabold leading-7 text-[#354172]">{item.questionText}</p>
                          <p className="mt-2 text-sm font-bold text-[#6f7da8]">正解：{item.correctAnswer}</p>
                        </div>
                        <button type="button" onClick={() => handleMasterBattleWrong(item.wrongId)} className="pill-button shrink-0 px-4 py-2 text-sm">
                          できた！
                        </button>
                      </div>
                      <p className="mt-3 rounded-[20px] bg-[#fff8d9] px-4 py-3 text-sm font-bold leading-6 text-[#6b5a2d]">
                        {item.explanation || '解説はまだ準備中です。'}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {grammarFormWrongList.length > 0 && (
              <section className="rounded-[28px] bg-[#eef8ff] p-4">
                <h3 className="display-font text-xl font-extrabold text-[#354172]">文法練習のまちがい</h3>
                <p className="mt-1 text-sm font-bold text-[#6f7da8]">拡張練習でまちがえた文法問題です。確認できたら復習済みにできます。</p>
                <div className="mt-4 space-y-3">
                  {grammarFormWrongList.map((item) => (
                    <article key={item.testId} className="rounded-[24px] bg-white/88 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.10)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <span className="rounded-full bg-[#fff8d9] px-3 py-1 text-xs font-black text-[#6b5a2d]">{item.category} / {item.title}</span>
                          <p className="mt-3 text-base font-extrabold leading-7 text-[#354172]">{item.questionJp}</p>
                          <p className="mt-2 rounded-[18px] bg-[#f8fbff] px-4 py-3 text-sm font-black text-[#31406f]">{item.promptEn}</p>
                          <p className="mt-2 text-sm font-bold text-[#6f7da8]">答え: {item.correctAnswer}</p>
                          <p className="mt-2 text-sm font-bold leading-6 text-[#6f7da8]">{item.correctReasonJp}</p>
                        </div>
                        <button type="button" onClick={() => handleMasterGrammarFormWrong(item.testId)} className="pill-button shrink-0 px-4 py-2 text-sm">
                          できた！
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {eikenWrongList.length > 0 && (
              <section className="rounded-[28px] bg-[#eef8ff] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="display-font text-xl font-extrabold text-[#354172]">英検チャレンジのまちがい</h3>
                    <p className="mt-1 text-sm font-bold text-[#6f7da8]">模擬テストでまちがえた問題です。答えと解説を見ながら復習できます。</p>
                  </div>
                  <Link
                    to={`/eiken-pre2/wrong-review?student_id=${encodeURIComponent(selectedChildId)}`}
                    className="pill-button shrink-0 px-5 py-3 text-sm"
                  >
                    英検錯題を練習
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {eikenWrongList.slice(0, 3).map((item) => (
                    <WrongQuestionCard key={item.question_id} question={item} />
                  ))}
                </div>
                {eikenWrongList.length > 3 && (
                  <div className="mt-4 text-center text-sm font-bold text-[#6f7da8]">
                    ほか {eikenWrongList.length - 3} 問あります。英検錯題練習で続けましょう。
                  </div>
                )}
              </section>
            )}

          </div>
        )}
      </motion.section>
    </WebLearningLayout>
  );
}
