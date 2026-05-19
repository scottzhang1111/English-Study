import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import TtsButton from '../components/TtsButton';
import WebLearningLayout from '../components/WebLearningLayout';
import { getLearnedWords, submitVocabExpansionAnswer } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function splitTerms(value) {
  return String(value || '')
    .split(/[;,/、，；]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getRelatedTerms(word) {
  return {
    synonyms: splitTerms(word.synonyms),
    antonyms: splitTerms(word.antonyms),
  };
}

function hasRelatedTerms(word) {
  const related = getRelatedTerms(word);
  return related.synonyms.length > 0 || related.antonyms.length > 0;
}

function buildQuestion(word, pool) {
  const related = getRelatedTerms(word);
  const mode = related.synonyms.length > 0 ? 'synonym' : 'antonym';
  const correctPool = mode === 'synonym' ? related.synonyms : related.antonyms;
  const correct = shuffleItems(correctPool)[0];
  const distractors = shuffleItems(
    pool
      .filter((item) => String(item.id) !== String(word.id))
      .flatMap((item) => [...getRelatedTerms(item).synonyms, ...getRelatedTerms(item).antonyms])
      .filter((term) => term && term.toLowerCase() !== correct.toLowerCase()),
  ).slice(0, 3);

  return {
    id: word.id,
    word: word.word,
    mode,
    question: `${word.word} に近い意味の言葉を選ぼう`,
    choices: shuffleItems([correct, ...distractors]),
    correct,
    japanese: word.jp,
    example: word.example,
    example_jp: word.example_jp,
    synonyms: related.synonyms,
    synonyms_japanese: word.synonyms_japanese,
    antonyms: related.antonyms,
    antonyms_japanese: word.antonyms_japanese,
  };
}

export default function VocabExpansionPage() {
  const [view, setView] = useState('list');
  const [words, setWords] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const eligibleWords = useMemo(() => words.filter(hasRelatedTerms), [words]);
  const currentQuestion = questions[quizIndex] || null;
  const quizDone = view === 'quiz' && questions.length > 0 && quizIndex >= questions.length;
  const correctCount = answers.filter((item) => item.correct).length;
  const rightPanel = (
    <div className="rounded-3xl border border-white/80 bg-white/86 p-5 shadow-[0_16px_36px_rgba(129,164,199,0.14)] backdrop-blur">
      <p className="text-xs font-bold text-[#8fa0c2]">小テスト</p>
      <h2 className="mt-2 text-2xl font-bold text-[#31406f]">{eligibleWords.length} words</h2>
      <div className="mt-5 grid gap-3 text-sm font-bold text-[#60709d]">
        <div className="rounded-2xl bg-[#f8fcff] p-3">モード: {view === 'quiz' ? 'テスト中' : '一覧'}</div>
        <div className="rounded-2xl bg-[#fff8d9] p-3">進み具合: {questions.length ? `${Math.min(quizIndex + 1, questions.length)} / ${questions.length}` : '-'}</div>
        <div className="rounded-2xl bg-[#f8fcff] p-3">正解: {correctCount}</div>
      </div>
      <button type="button" onClick={() => setView('list')} disabled={!eligibleWords.length} className="pill-button mt-5 w-full px-4 py-3 text-sm disabled:opacity-50">
        単語一覧
      </button>
    </div>
  );

  const loadWords = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getLearnedWords(localStorage.getItem(CHILD_STORAGE_KEY) || '');
      setWords(payload.words || []);
      setView('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWords();
  }, []);

  const startQuiz = () => {
    const selected = shuffleItems(eligibleWords).slice(0, Math.min(5, eligibleWords.length));
    const nextQuestions = selected
      .map((word) => buildQuestion(word, eligibleWords))
      .filter((question) => question.choices.length >= 4);
    setQuestions(nextQuestions);
    setQuizIndex(0);
    setAnswer('');
    setAnswers([]);
    setResult(null);
    setView('quiz');
  };

  const handleAnswer = async (choice) => {
    if (!currentQuestion || answer) return;
    setAnswer(choice);
    const correct = choice === currentQuestion.correct;
    setAnswers((prev) => [...prev, { question: currentQuestion, selected: choice, correct }]);
    try {
      const payload = await submitVocabExpansionAnswer({
        id: currentQuestion.id,
        selected: choice,
        correct: currentQuestion.correct,
        childId: localStorage.getItem(CHILD_STORAGE_KEY) || '',
      });
      setResult(payload);
    } catch (err) {
      setError(err.message);
    }
  };

  const nextQuestion = () => {
    if (quizIndex >= questions.length - 1) {
      setQuizIndex(questions.length);
      return;
    }
    setQuizIndex((index) => index + 1);
    setAnswer('');
    setResult(null);
  };

  return (
    <WebLearningLayout title="類義語・対義語" subtitle="関連語を広く確認" rightPanel={rightPanel}>
      <HeaderBar subtitle="類義語・対義語" />

      {error ? (
        <div className="panel px-5 py-5 text-sm text-rose-700">{error}</div>
      ) : (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="panel px-6 py-6 sm:px-8">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-6">
            <p className="text-sm font-black text-[#6f7da8]">ことばを広げる</p>
            <h1 className="display-font mt-2 text-3xl font-extrabold text-[#354172] sm:text-4xl">類義語・対義語</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-[#6f7da8]">
              覚えた単語から、近い意味や反対の意味を確認します。
            </p>
          </div>

          {loading ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-5 text-center text-sm font-bold text-[#60709d]">読み込み中...</div>
          ) : eligibleWords.length === 0 ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-6 text-center text-sm font-bold leading-7 text-[#60709d]">
              まだ類義語・対義語を練習できる単語がありません。これから学習していくと、このメニューが開きます。
            </div>
          ) : view === 'detail' && selectedWord ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-5">
              <button type="button" onClick={() => setView('list')} className="ghost-button px-4 py-2 text-sm">一覧へ戻る</button>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <h2 className="display-font text-4xl font-extrabold text-[#354172]">{selectedWord.word}</h2>
                <TtsButton text={selectedWord.word} label="単語" />
              </div>
              <p className="mt-2 text-lg font-bold text-[#60709d]">{selectedWord.jp}</p>
              {selectedWord.example && (
                <div className="mt-5 rounded-[22px] bg-[#f8fbff] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-bold leading-7 text-[#60709d]">{selectedWord.example}</p>
                    <TtsButton text={selectedWord.example} label="例文" />
                  </div>
                </div>
              )}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] bg-[#f8fbff] p-4">
                  <p className="text-sm font-black text-[#6f7da8]">類義語・近い言葉</p>
                  <p className="mt-2 text-lg font-extrabold text-[#354172]">{getRelatedTerms(selectedWord).synonyms.join(', ') || '-'}</p>
                  {selectedWord.synonyms_japanese && <p className="mt-2 text-sm font-bold text-[#60709d]">{selectedWord.synonyms_japanese}</p>}
                </div>
                <div className="rounded-[22px] bg-[#fff8e7] p-4">
                  <p className="text-sm font-black text-[#8b6b2f]">対義語・反対の言葉</p>
                  <p className="mt-2 text-lg font-extrabold text-[#354172]">{getRelatedTerms(selectedWord).antonyms.join(', ') || '-'}</p>
                  {selectedWord.antonyms_japanese && <p className="mt-2 text-sm font-bold text-[#60709d]">{selectedWord.antonyms_japanese}</p>}
                </div>
              </div>
            </div>
          ) : view === 'quiz' ? (
            <div className="mt-6">
              {quizDone ? (
                <div className="rounded-[24px] bg-white/78 p-5 text-sm font-bold leading-7 text-[#60709d]">
                  <p className="text-lg font-black text-[#354172]">結果: {correctCount} / {questions.length}</p>
                  <button type="button" onClick={() => setView('list')} className="pill-button mt-5 px-5 py-3">一覧へ戻る</button>
                </div>
              ) : currentQuestion ? (
                <>
                  <p className="text-sm font-black text-[#6f7da8]">{quizIndex + 1} / {questions.length}</p>
                  <h2 className="display-font mt-3 text-3xl font-extrabold text-[#354172]">{currentQuestion.question}</h2>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {currentQuestion.choices.map((choice) => {
                      const isCorrect = answer && choice === currentQuestion.correct;
                      const isWrong = answer === choice && choice !== currentQuestion.correct;
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => handleAnswer(choice)}
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
                  {answer && (
                    <div className="mt-5 rounded-[24px] bg-[#f9fcff] p-5 text-sm font-bold leading-7 text-[#60709d]">
                      <p className="text-base font-black text-[#354172]">{answer === currentQuestion.correct ? 'せいかい！' : `こたえ: ${currentQuestion.correct}`}</p>
                      {result?.pet_exp_awarded > 0 && <p className="mt-2 text-[#6b5a2d]">ペット EXP +{result.pet_exp_awarded}</p>}
                      <button type="button" onClick={nextQuestion} className="pill-button mt-4 px-5 py-3">
                        {quizIndex >= questions.length - 1 ? '結果を見る' : '次へ'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[24px] bg-white/78 p-5 text-center text-sm font-bold text-[#60709d]">
                  4択問題を作るには、関連語のある単語がもう少し必要です。
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#6f7da8]">{eligibleWords.length} words</p>
                  <h2 className="display-font mt-1 text-2xl font-extrabold text-[#354172]">確認したい単語を選ぼう</h2>
                </div>
                <button type="button" onClick={startQuiz} className="pill-button px-5 py-3">小テストを始める</button>
              </div>
              <div className="grid gap-3">
                {eligibleWords.map((word) => (
                  <article
                    key={`${word.id}-${word.word}`}
                    className="rounded-[24px] border border-white/80 bg-white/82 px-5 py-4 shadow-[0_12px_28px_rgba(145,177,209,0.10)] transition hover:-translate-y-0.5 hover:bg-[#f8fcff]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWord(word);
                          setView('detail');
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="display-font block text-2xl font-extrabold text-[#354172]">{word.word}</span>
                        <span className="mt-1 block text-sm font-bold text-[#60709d]">{word.jp}</span>
                      </button>
                      <TtsButton text={word.word} label="Word" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </motion.section>
      )}
    </WebLearningLayout>
  );
}
