import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import WebLearningLayout from '../components/WebLearningLayout';
import { addPetExp, getFlashcardData, getHomeData, getLearnedWords, getTodayReviewQuiz, markMastered } from '../api';

const DAILY_TARGET = 20;
const CHILD_STORAGE_KEY = 'selected_child_id';

const RECALL_OPTIONS = [
  { key: 'know', label: 'わかる' },
  { key: 'unsure', label: 'たぶん' },
  { key: 'dont_know', label: 'まだ' },
];

const REVIEW_TYPE_LABELS = {
  Listening: 'リスニング',
  Meaning: '意味',
  Reverse: '日本語から英語',
  Cloze: '穴うめ',
};

function playAudio(text, audioRef) {
  if (!text) return;
  if (audioRef.current) {
    audioRef.current.pause();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

function buildCloze(sentence, word) {
  if (!sentence || !word) return '';
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withBoundary = sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '______');
  if (withBoundary !== sentence) return withBoundary;
  return sentence.replace(new RegExp(escaped, 'i'), '______');
}

function getMasteryStars(word) {
  const mastery = Number(word?.mastery || 0);
  const correctCount = Number(word?.correct_count || 0);
  const reviewCount = Number(word?.review_count || 0);
  const wrongCount = Number(word?.wrong_count || 0);
  const score = mastery || Math.max(0, Math.min(100, correctCount * 18 + reviewCount * 8 - wrongCount * 16));
  return Math.max(1, Math.min(5, Math.ceil(score / 20)));
}

function MasteryStars({ count }) {
  return (
    <span className="inline-flex gap-0.5 text-lg" aria-label={`習熟度 ${count} / 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < count ? 'text-[#ffc933]' : 'text-[#d7e2ef]'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function FlashcardPage() {
  const [homeData, setHomeData] = useState(null);
  const [flashcard, setFlashcard] = useState(null);
  const [studyLoading, setStudyLoading] = useState(true);
  const [studyError, setStudyError] = useState(null);
  const [step, setStep] = useState(1);
  const [recallChoice, setRecallChoice] = useState('');
  const [fillAnswer, setFillAnswer] = useState('');
  const [fillFeedback, setFillFeedback] = useState('');
  const [fillCorrect, setFillCorrect] = useState(false);
  const [earnedExp, setEarnedExp] = useState(0);
  const [mode, setMode] = useState('study');
  const [studyWords, setStudyWords] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyEmpty, setStudyEmpty] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewAnswer, setReviewAnswer] = useState('');
  const [reviewLocked, setReviewLocked] = useState(false);
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewStreak, setReviewStreak] = useState(0);
  const audioRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const selectedChildId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const requestedWord = searchParams.get('word') || '';
  const shouldLoadReviewQuiz = location.pathname.includes('today-review-quiz');
  const progressValue = Math.min(DAILY_TARGET, Number(homeData?.progress || 0));
  const progressPercent = `${(progressValue / DAILY_TARGET) * 100}%`;
  const dayLabel = `Day ${Math.floor(progressValue / DAILY_TARGET) + 1}`;
  const studyProgressPercent = studyWords.length ? `${((studyIndex + 1) / studyWords.length) * 100}%` : '0%';
  const progressText = mode === 'list'
    ? `${studyWords.length} words`
    : mode === 'study'
    ? studyWords.length
      ? `${studyIndex + 1} / ${studyWords.length} words`
      : studyEmpty
        ? '0 words'
        : '読み込み中...'
    : `${progressValue} / ${DAILY_TARGET} words`;
  const currentReviewQuestion = reviewData?.questions?.[reviewIndex] || null;
  const reviewTotal = reviewData?.questions?.length || 0;
  const clozeSentence = useMemo(
    () => buildCloze(flashcard?.example || '', flashcard?.word || ''),
    [flashcard?.example, flashcard?.word],
  );

  const showWordList = (words = studyWords) => {
    setStudyWords(words);
    setFlashcard(null);
    setStep(1);
    setEarnedExp(0);
    setStudyEmpty(words.length === 0);
    setMode('list');
  };

  const showStudyWord = (wordItem, index, words = studyWords) => {
    if (!wordItem) {
      setFlashcard(null);
      setStudyEmpty(true);
      setStudyLoading(false);
      return;
    }
    setStudyWords(words);
    setStudyIndex(index);
    setFlashcard({
      ...wordItem,
      sentence_jp: wordItem.sentence_jp || wordItem.example_jp,
    });
    setStep(1);
    setRecallChoice('');
    setFillAnswer('');
    setFillFeedback('');
    setFillCorrect(false);
    setEarnedExp(0);
    setMode('study');
    setStudyEmpty(false);
  };

  const loadLearnedStudyWords = async () => {
    setStudyLoading(true);
    setStudyError(null);
    try {
      const payload = await getLearnedWords(selectedChildId);
      const words = payload.words || [];
      showWordList(words);
    } catch (err) {
      setStudyError(err.message);
    } finally {
      setStudyLoading(false);
    }
  };

  const openStudyWord = (wordItem, index) => {
    showStudyWord(wordItem, index, studyWords);
  };

  const loadStudyWord = async (word) => {
    setStudyLoading(true);
    setStudyError(null);
    try {
      const payload = await getFlashcardData({ word, childId: selectedChildId });
      showStudyWord(payload, 0, [payload]);
    } catch (err) {
      setStudyError(err.message);
    } finally {
      setStudyLoading(false);
    }
  };

  const loadReviewQuiz = async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const payload = await getTodayReviewQuiz(selectedChildId);
      setReviewData(payload);
      setReviewIndex(0);
      setReviewAnswer('');
      setReviewLocked(false);
      setReviewScore(0);
      setReviewStreak(0);
      setEarnedExp(0);
      setMode('review');
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!selectedChildId) {
        navigate('/select-child', { replace: true });
        return;
      }
      try {
        const payload = await getHomeData(selectedChildId);
        if (cancelled) return;
        setHomeData(payload);
        if (shouldLoadReviewQuiz) {
          await loadReviewQuiz();
        } else if (requestedWord) {
          await loadStudyWord(requestedWord);
        } else {
          await loadLearnedStudyWords();
        }
      } catch (err) {
        if (!cancelled) setStudyError(err.message);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [selectedChildId, requestedWord, shouldLoadReviewQuiz]);

  const awardPetExp = async (expAmount) => {
    if (!selectedChildId) return;
    try {
      const payload = await addPetExp(selectedChildId, expAmount);
      setEarnedExp(expAmount);
      setHomeData((prev) => ({
        ...(prev || {}),
        pet: payload.pet,
      }));
    } catch (err) {
      setStudyError(err.message);
    }
  };

  const handleNextStudy = async () => {
    if (!flashcard) return;
    try {
      const result = await markMastered({
        word: flashcard.word,
        childId: selectedChildId,
        vocabId: flashcard.id,
      });
      const nextProgress = Number(result?.progress ?? progressValue + 1);
      setHomeData((prev) => ({
        ...(prev || {}),
        progress: nextProgress,
        target: result?.target ?? DAILY_TARGET,
        remain: result?.remain ?? Math.max(0, DAILY_TARGET - nextProgress),
      }));

      const hasReviewSequence = !requestedWord && studyWords.length > 0;
      if (hasReviewSequence && studyIndex < studyWords.length - 1) {
        showStudyWord(studyWords[studyIndex + 1], studyIndex + 1, studyWords);
      } else if (hasReviewSequence || requestedWord || nextProgress >= DAILY_TARGET) {
        navigate('/progress');
      } else {
        await loadLearnedStudyWords();
      }
    } catch (err) {
      setStudyError(err.message);
    }
  };

  const handleSubmitFill = async () => {
    if (!flashcard) return;
    const correct = (flashcard.word || '').trim().toLowerCase();
    const answer = fillAnswer.trim().toLowerCase();
    const isCorrect = Boolean(correct) && correct === answer;
    const expAmount = isCorrect ? 10 : 2;
    setFillCorrect(isCorrect);
    setFillFeedback(isCorrect ? 'せいかい！' : `こたえ: ${flashcard.word}`);
    await awardPetExp(expAmount);
    setStep(5);
  };

  const handleReviewChoice = async (choice) => {
    if (!currentReviewQuestion || reviewLocked) return;
    setReviewAnswer(choice);
    setReviewLocked(true);
    const isCorrect = choice === currentReviewQuestion.correct;
    if (isCorrect) {
      setReviewScore((score) => score + 1);
      setReviewStreak((streak) => streak + 1);
    } else {
      setReviewStreak(0);
    }
    await awardPetExp(isCorrect ? 10 : 2);
  };

  const handleReviewNext = () => {
    if (reviewIndex < reviewTotal - 1) {
      setReviewIndex((index) => index + 1);
      setReviewAnswer('');
      setReviewLocked(false);
      setEarnedExp(0);
      return;
    }
    navigate('/progress');
  };

  const progressWidth = mode === 'list'
    ? studyWords.length ? '100%' : '0%'
    : mode === 'study'
    ? studyProgressPercent
    : mode === 'review-complete' || progressValue >= DAILY_TARGET
      ? '100%'
      : progressPercent;
  const rightPanel = (
    <div className="rounded-3xl border border-white/80 bg-white/86 p-5 shadow-[0_16px_36px_rgba(129,164,199,0.14)] backdrop-blur">
      <p className="text-xs font-bold text-[#8fa0c2]">今日の単語</p>
      <h2 className="mt-2 text-2xl font-bold text-[#31406f]">{progressValue} / {DAILY_TARGET}</h2>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#edf1f7]">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffe65a,#ffb81f)]" style={{ width: progressPercent }} />
      </div>
      <div className="mt-5 grid gap-3 text-sm font-bold text-[#60709d]">
        <div className="rounded-2xl bg-[#f8fcff] p-3">表示中: {progressText}</div>
        <div className="rounded-2xl bg-[#fff8d9] p-3">復習スコア: {reviewScore}</div>
        <div className="rounded-2xl bg-[#f8fcff] p-3">単語一覧: {studyWords.length}</div>
      </div>
      <div className="mt-5 grid gap-3">
        <button type="button" onClick={() => loadLearnedStudyWords()} className="pill-button px-4 py-3 text-sm">単語一覧</button>
        <button type="button" onClick={() => navigate('/quiz')} className="ghost-button px-4 py-3 text-sm">クイズに進む</button>
      </div>
    </div>
  );
  if (studyError) {
    return (
      <WebLearningLayout title="単語カード" subtitle="覚えた単語を広く確認" rightPanel={rightPanel}>
        <HeaderBar subtitle="単語カード" />
        <div className="panel px-5 py-5 text-sm text-rose-700">{studyError}</div>
      </WebLearningLayout>
    );
  }

  if (reviewError && mode === 'review') {
    return (
      <WebLearningLayout title="単語カード" subtitle="復習クイズ" rightPanel={rightPanel}>
        <HeaderBar subtitle="単語カード" />
        <div className="panel px-5 py-5 text-sm text-rose-700">{reviewError}</div>
      </WebLearningLayout>
    );
  }

  return (
    <WebLearningLayout title="単語カード" subtitle="単語リストとカード学習" rightPanel={rightPanel}>
      <HeaderBar subtitle="単語カード" />

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel overflow-hidden px-6 py-6 sm:px-8"
      >
        <div className="mb-5 rounded-[28px] bg-[linear-gradient(180deg,#f8fbff_0%,#eef8ff_100%)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#6f7da8]">{dayLabel}</p>
              <h2 className="display-font mt-1 text-3xl font-extrabold text-[#354172]">{progressText}</h2>
            </div>
            <div className="rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-bold text-[#69557e]">
              {mode === 'review' || mode === 'review-complete' ? '復習クイズ' : mode === 'list' ? '単語一覧' : '単語復習'}
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e6f4ff]">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#ffd966,#ffbf2f)]"
              initial={false}
              animate={{ width: progressWidth }}
              transition={{ duration: 0.35 }}
            />
          </div>
        </div>

        <div>
            {mode === 'list' && (
              <AnimatePresence mode="wait">
                {studyLoading ? (
                  <motion.div
                    key="list-loading"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-[#6f7da8]"
                  >
                    読み込み中...
                  </motion.div>
                ) : studyEmpty ? (
                  <motion.div
                    key="list-empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-[#6f7da8]"
                  >
                    <h2 className="display-font text-2xl font-extrabold text-[#354172]">まだ復習できる単語がありません</h2>
                    <p className="mt-3 text-sm font-bold leading-7">まず今日の学習で単語を覚えてから、ここに単語リストを作りましょう。</p>
                    <button type="button" onClick={() => navigate('/daily-words')} className="pill-button mt-6 px-6 py-3">
                      今日の学習へ
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="word-list"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="space-y-5"
                  >
                    <div>
                      <p className="text-sm font-black text-[#6f7da8]">覚えた単語</p>
                      <h2 className="display-font mt-1 text-3xl font-extrabold text-[#354172]">確認したい単語を選ぼう</h2>
                    </div>

                    <div className="grid gap-3">
                      {studyWords.map((word, index) => {
                        const stars = getMasteryStars(word);
                        return (
                          <button
                            key={`${word.id}-${word.word}`}
                            type="button"
                            onClick={() => openStudyWord(word, index)}
                            className="group flex flex-col gap-3 rounded-[24px] border border-white/80 bg-white/82 px-5 py-4 text-left shadow-[0_12px_28px_rgba(145,177,209,0.10)] transition hover:-translate-y-0.5 hover:bg-[#f8fcff] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="min-w-0">
                              <span className="display-font block text-2xl font-extrabold text-[#354172]">{word.word}</span>
                              <span className="mt-1 block text-sm font-bold leading-6 text-[#60709d]">{word.jp || '意味を読み込み中...'}</span>
                            </span>
                            <span className="flex shrink-0 flex-col gap-1 sm:items-end">
                              <MasteryStars count={stars} />
                              <span className="text-xs font-black text-[#7b8aad]">
                                練習 {Number(word.review_count || 0)} / まちがい {Number(word.wrong_count || 0)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {mode === 'study' && (
              <AnimatePresence mode="wait">
                {studyEmpty ? (
                  <motion.div
                    key="study-empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-[#6f7da8]"
                  >
                    <h2 className="display-font text-2xl font-extrabold text-[#354172]">まだ復習できる単語がありません</h2>
                    <p className="mt-3 text-sm font-bold leading-7">まず今日の学習で単語を覚えてから、ここで順番に復習しましょう。</p>
                    <button type="button" onClick={() => navigate('/daily-words')} className="pill-button mt-6 px-6 py-3">
                      今日の学習へ
                    </button>
                  </motion.div>
                ) : studyLoading || !flashcard ? (
                  <motion.div
                    key="study-loading"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-[#6f7da8]"
                  >
                    読み込み中...
                  </motion.div>
                ) : (
                  <motion.div
                    key={flashcard.word}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.22 }}
                  >
                    {step === 1 && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
                            {flashcard?.importance ? `重要度 ${flashcard.importance}` : '単語カード'}
                          </div>
                          {!requestedWord && studyWords.length > 0 && (
                            <button type="button" onClick={() => showWordList(studyWords)} className="ghost-button px-4 py-2 text-sm">
                              一覧へ戻る
                            </button>
                          )}
                        </div>
                        <h2 className="display-font text-4xl font-extrabold text-[#354172] sm:text-5xl">{flashcard.word}</h2>
                        <p className="text-lg font-bold text-[#7081ab]">まず音を聞いて、意味をたしかめよう。</p>
                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={() => playAudio(flashcard.word, audioRef)} className="pill-button px-6 py-3">
                            音を聞く
                          </button>
                          <button type="button" onClick={() => setStep(2)} className="ghost-button px-6 py-3">
                            意味を見る
                          </button>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-4">
                        <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
                          思い出してみよう
                        </div>
                        <h2 className="display-font text-4xl font-extrabold text-[#354172] sm:text-5xl">{flashcard.word}</h2>
                        <p className="text-lg font-bold text-[#7081ab]">この単語を覚えているかな？</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {RECALL_OPTIONS.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => {
                                setRecallChoice(option.key);
                                setStep(3);
                              }}
                              className={`rounded-[24px] border px-5 py-4 text-base font-bold transition ${
                                recallChoice === option.key
                                  ? 'border-[#ffcf48] bg-[#fff4bf] text-[#5e4e76]'
                                  : 'border-white/80 bg-white/80 text-[#34406f] hover:bg-[#f6fbff]'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-4">
                        <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
                          意味と例文
                        </div>
                        <h2 className="display-font text-4xl font-extrabold text-[#354172] sm:text-5xl">{flashcard.word}</h2>
                        <p className="text-lg font-bold text-[#7081ab]">{flashcard.jp || '意味を読み込み中...'}</p>

                        <div className="space-y-4">
                          <div className="rounded-[24px] bg-white/78 px-5 py-4 text-sm font-bold text-[#60709d]">
                            意味: {flashcard.jp || '-'}
                          </div>
                          <div className="rounded-[24px] bg-white/78 px-5 py-4 text-sm font-bold text-[#60709d]">
                            英語の例文: {flashcard.example || '-'}
                          </div>
                          <div className="rounded-[24px] bg-white/78 px-5 py-4 text-sm font-bold text-[#60709d]">
                            例文の意味: {flashcard.sentence_jp || flashcard.example_jp || '-'}
                          </div>
                          {flashcard.example_short && (
                            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-sm font-bold text-[#60709d]">
                              短い例文: {flashcard.example_short}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={() => playAudio(flashcard.word, audioRef)} className="pill-button px-6 py-3">
                            単語を聞く
                          </button>
                          <button type="button" onClick={() => playAudio(flashcard.example, audioRef)} className="ghost-button px-6 py-3">
                            例文を聞く
                          </button>
                          <button type="button" onClick={() => setStep(4)} className="ghost-button px-6 py-3">
                            穴うめへ
                          </button>
                        </div>
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-4">
                        <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
                          穴うめ
                        </div>
                        <h2 className="display-font text-3xl font-extrabold text-[#354172] sm:text-4xl">
                          {clozeSentence || '例文を読み込み中...'}
                        </h2>
                        <p className="text-lg font-bold text-[#7081ab]">空いているところに入る単語を書こう。</p>

                        <div className="rounded-[28px] bg-white/82 p-5 shadow-[0_18px_40px_rgba(145,177,209,0.18)]">
                          <label className="block text-sm font-bold text-[#6f7da8]">
                            こたえ
                            <input
                              value={fillAnswer}
                              onChange={(event) => setFillAnswer(event.target.value)}
                              placeholder="こたえ"
                              className="mt-3 w-full rounded-[20px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172] outline-none"
                            />
                          </label>
                          {fillFeedback && <p className="mt-4 text-sm font-bold text-[#61719e]">{fillFeedback}</p>}
                          <div className="mt-5 flex flex-wrap gap-3">
                            <button type="button" onClick={handleSubmitFill} className="pill-button px-6 py-3">
                              確認
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFillAnswer('');
                                setFillFeedback('');
                              }}
                              className="ghost-button px-6 py-3"
                            >
                              もう一度
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 5 && (
                      <div className="space-y-4">
                        <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
                          完了
                        </div>
                        <h2 className="display-font text-4xl font-extrabold text-[#354172] sm:text-5xl">
                          {fillCorrect ? 'よくできました！' : 'ここまでできたね！'}
                        </h2>
                        <p className="text-lg font-bold text-[#7081ab]">{fillFeedback || '単語と例文を確認できました。'}</p>
                        {earnedExp > 0 && (
                          <div className="rounded-[24px] bg-[#fff2bb] px-4 py-3 text-sm font-black text-[#6b5a2d]">
                            ペット EXP +{earnedExp}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={handleNextStudy} className="pill-button px-6 py-3">
                            次の単語
                          </button>
                          <button type="button" onClick={() => setStep(1)} className="ghost-button px-6 py-3">
                            もう一度見る
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {mode === 'review' && (
              <AnimatePresence mode="wait">
                {reviewLoading || !reviewData ? (
                  <motion.div
                    key="review-loading"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-[#6f7da8]"
                  >
                    復習クイズを読み込み中...
                  </motion.div>
                ) : reviewTotal === 0 ? (
                  <motion.div
                    key="review-empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-[#6f7da8]"
                  >
                    まだ復習問題はありません。
                  </motion.div>
                ) : (
                  <motion.div
                    key={currentReviewQuestion?.id || reviewIndex}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
                        復習クイズ
                      </div>
                      <div className="rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-bold text-[#69557e]">
                        {REVIEW_TYPE_LABELS[currentReviewQuestion?.type] || currentReviewQuestion?.type || 'Quiz'}
                      </div>
                    </div>

                    <h2 className="display-font mt-4 text-3xl font-extrabold text-[#354172] sm:text-4xl">
                      {currentReviewQuestion?.question || '問題を読み込み中...'}
                    </h2>

                    {currentReviewQuestion?.type === 'Listening' && (
                      <div className="mt-5">
                        <button
                          type="button"
                          onClick={() => playAudio(currentReviewQuestion.audio_text || currentReviewQuestion.word, audioRef)}
                          className="pill-button px-6 py-3"
                        >
                          音声を聞く
                        </button>
                      </div>
                    )}

                    <div className="mt-6 grid gap-3">
                      {(currentReviewQuestion?.choices || []).map((choice) => {
                        const isCorrect = reviewLocked && choice === currentReviewQuestion.correct;
                        const isWrong = reviewLocked && choice === reviewAnswer && choice !== currentReviewQuestion.correct;
                        return (
                          <motion.button
                            key={choice}
                            type="button"
                            onClick={() => handleReviewChoice(choice)}
                            disabled={reviewLocked}
                            whileTap={{ scale: 0.98 }}
                            className={`rounded-[24px] border px-5 py-4 text-left text-lg font-bold transition ${
                              isCorrect
                                ? 'border-[#ffcf48] bg-[#fff4bf] text-[#5e4e76]'
                                : isWrong
                                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                                  : 'border-white/80 bg-white/80 text-[#34406f] hover:bg-[#f6fbff]'
                            }`}
                          >
                            {choice}
                          </motion.button>
                        );
                      })}
                    </div>

                    {reviewLocked && currentReviewQuestion && (
                      <motion.div
                        key={`${currentReviewQuestion.id}-${reviewAnswer}-${reviewStreak}`}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.18 }}
                        className="mt-5 rounded-[24px] bg-[#f9fcff] px-5 py-4 text-sm font-bold text-[#60709d]"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#6f7da8]">
                            {reviewAnswer === currentReviewQuestion.correct ? 'せいかい' : '復習'}
                          </span>
                          <span className="rounded-full bg-[#fff2bb] px-3 py-1 text-xs font-black text-[#69557e]">
                            連続 {reviewStreak}
                          </span>
                          {earnedExp > 0 && (
                            <span className="rounded-full bg-[#e8f8ee] px-3 py-1 text-xs font-black text-[#2c7d4f]">
                              ポケモン EXP +{earnedExp}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 leading-6">
                          {reviewAnswer === currentReviewQuestion.correct ? 'よくできました！' : `こたえ: ${currentReviewQuestion.correct}`}
                        </p>
                      </motion.div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-white/72 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#6f7da8]">
                          {reviewIndex + 1} / {reviewTotal}
                        </div>
                        <motion.div
                          key={reviewStreak}
                          initial={{ scale: 0.92, opacity: 0.7 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.18 }}
                          className="rounded-full bg-[#fff2bb] px-3 py-1 text-xs font-black text-[#69557e]"
                        >
                          連続 {reviewStreak}
                        </motion.div>
                      </div>
                      <div className="text-sm font-bold text-[#7280a8]">{reviewScore} せいかい</div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={() => window.location.assign('/app/')} className="ghost-button px-5 py-3">
                        ホーム
                      </button>
                      <button
                        type="button"
                        onClick={handleReviewNext}
                        disabled={!reviewLocked}
                        className="pill-button px-5 py-3 disabled:opacity-40"
                      >
                        {reviewIndex < reviewTotal - 1 ? '次の問題' : '結果を見る'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
        </div>
      </motion.section>
    </WebLearningLayout>
  );
}
