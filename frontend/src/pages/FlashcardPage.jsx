import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import WebLearningLayout from '../components/WebLearningLayout';
import {
  EQBottomNav,
  EQCard,
  EQMobileShell,
  GoldQuestButton,
  MagicPanel,
  QuestHeader,
  QuestProgressStepper,
    PurificationQuizMobile,
} from '../components/eigo';
import {
  getDailyWords,
  getFlashcardData,
  getHomeData,
  getLearnedWords,
  getTodayReviewQuiz,
  markMastered,
  submitStageQuizAttempt,
} from '../api';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import { getWorldStageByLearnedWords } from '../helpers/eigoQuestProgress';
import { savePendingRewardQueue } from '../helpers/eigoQuestRewards';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

const DAILY_TARGET = 20;
const CHILD_STORAGE_KEY = 'selected_child_id';
const STAGE_QUIZ_ATTEMPT_STORAGE_PREFIX = 'eigo_quest_stage_quiz_attempt';
const SPIRIT_IMAGE = '/assets/eigo-quest/spirit_assets/happy.png';
const WORLD_NAME_JA = {
  wind: '風の世界',
  fire: '火の世界',
  water: '水の世界',
  thunder: '雷の世界',
  wood: '木の世界',
  rock: '岩の世界',
  light: '光の世界',
  shadow: '影の世界',
};

const WORLD_STUDY_DISPLAY = {
  wind: {
    nameJa: '風の世界',
    nameEn: 'WIND REALM',
    icon: '風',
    themeColor: '#35d9ff',
    backgroundImage: '/assets/eigo-quest/worlds/wind.png',
  },
  fire: {
    nameJa: '火の世界',
    nameEn: 'FIRE REALM',
    icon: '火',
    themeColor: '#ff8a36',
    backgroundImage: '/assets/eigo-quest/worlds/fire.png',
  },
  thunder: {
    nameJa: '雷の世界',
    nameEn: 'THUNDER REALM',
    icon: '雷',
    themeColor: '#b45cff',
    backgroundImage: '/assets/eigo-quest/worlds/thunder.png',
  },
  wood: {
    nameJa: '木の世界',
    nameEn: 'WOOD REALM',
    icon: '木',
    themeColor: '#7ee86f',
    backgroundImage: '/assets/eigo-quest/worlds/wood.png',
  },
  rock: {
    nameJa: '岩の世界',
    nameEn: 'ROCK REALM',
    icon: '岩',
    themeColor: '#ffc14d',
    backgroundImage: '/assets/eigo-quest/worlds/rock.png',
  },
  water: {
    nameJa: '水の世界',
    nameEn: 'WATER REALM',
    icon: '水',
    themeColor: '#42c8ff',
    backgroundImage: '/assets/eigo-quest/worlds/water.png',
  },
  light: {
    nameJa: '光の世界',
    nameEn: 'LIGHT REALM',
    icon: '光',
    themeColor: '#ffe071',
    backgroundImage: '/assets/eigo-quest/worlds/light.png',
  },
  shadow: {
    nameJa: '影の世界',
    nameEn: 'SHADOW REALM',
    icon: '影',
    themeColor: '#b45cff',
    backgroundImage: '/assets/eigo-quest/worlds/shadow.png',
  },
};

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

function getQuestWorldByLearnedWords(learnedWordsCount = 0) {
  return getWorldStageByLearnedWords(learnedWordsCount).world || eigoQuestWorlds[0];
}

function getStudyWorldDisplay(world) {
  if (!world?.id) return WORLD_STUDY_DISPLAY.wind;
  return {
    ...WORLD_STUDY_DISPLAY.wind,
    ...world,
    ...(WORLD_STUDY_DISPLAY[world.id] || {}),
  };
}

function getStageQuizAttemptStorageKey(childId, worldId, stage) {
  return `${STAGE_QUIZ_ATTEMPT_STORAGE_PREFIX}:${childId || 'default'}:${worldId || 'world'}:${stage || 'stage'}`;
}

function createStageQuizAttemptId() {
  return `stage-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getReviewAnswerKey(question) {
  return `${question?.id || ''}:${question?.type || ''}`;
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
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewAnswers, setReviewAnswers] = useState({});
  const [stageReviewQuestions, setStageReviewQuestions] = useState([]);
  const [reviewRetryQueue, setReviewRetryQueue] = useState([]);
  const audioRef = useRef(null);
  const reviewAttemptIdRef = useRef('');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routePrefix = location.pathname.startsWith('/app/') ? '/app' : '';

  const selectedChildId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const requestedWord = searchParams.get('word') || '';
  const requestedWordIndex = Number(searchParams.get('index'));
  const requestedWordTotal = Number(searchParams.get('total'));
  const requestedWorldId = searchParams.get('world') || '';
  const requestedStage = Number(searchParams.get('stage'));
  const hasRequestedStage = requestedWorldId && Number.isFinite(requestedStage) && requestedStage > 0;
  const dailyWordsPath = `${routePrefix}/daily-words${hasRequestedStage ? `?world=${encodeURIComponent(requestedWorldId)}&stage=${encodeURIComponent(requestedStage)}` : ''}`;
  const shouldLoadReviewQuiz = location.pathname.includes('today-review-quiz');
  const progressValue = Math.min(DAILY_TARGET, Number(homeData?.progress || 0));
  const requestedQuestWorld = requestedWorldId
    ? eigoQuestWorlds.find((world) => world.id === requestedWorldId)
    : null;
  const questWorld = requestedQuestWorld || (homeData
    ? getQuestWorldByLearnedWords(homeData.mastered_words ?? homeData.learned_words ?? homeData.progress ?? 0)
    : null);
  const studyWorldDisplay = getStudyWorldDisplay(questWorld);
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
  const safeRequestedWordIndex = Number.isFinite(requestedWordIndex) && requestedWordIndex >= 0 ? requestedWordIndex : 0;
  const safeRequestedWordTotal = Number.isFinite(requestedWordTotal) && requestedWordTotal > 0 ? requestedWordTotal : 0;
  const flashcardExampleText =
    flashcard?.example ||
    flashcard?.exampleEn ||
    flashcard?.example_en ||
    flashcard?.exampleEnglish ||
    flashcard?.Example_English ||
    '';

  const clozeSentence = useMemo(
    () => buildCloze(flashcardExampleText || '', flashcard?.word || ''),
    [flashcardExampleText, flashcard?.word],
  );

  const showWordList = (words = studyWords) => {
    setStudyWords(words);
    setFlashcard(null);
    setStep(1);
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

    const normalizedWord = {
      ...wordItem,

      jp:
        wordItem.jp ||
        wordItem.meaningJa ||
        wordItem.meaning_ja ||
        wordItem.japanese ||
        wordItem.Japanese ||
        '',

      example:
        wordItem.example ||
        wordItem.exampleEn ||
        wordItem.example_en ||
        wordItem.exampleEnglish ||
        wordItem.Example_English ||
        '',

      sentence_jp:
        wordItem.sentence_jp ||
        wordItem.example_jp ||
        wordItem.exampleJa ||
        wordItem.example_ja ||
        wordItem.sentenceJa ||
        wordItem.Example_Japanese ||
        '',

      part_of_speech:
        wordItem.part_of_speech ||
        wordItem.partOfSpeech ||
        wordItem.category ||
        wordItem.Category ||
        wordItem.pos ||
        wordItem.speech ||
        '',

      phrase:
        wordItem.phrase ||
        wordItem.Phrase ||
        wordItem.collocation ||
        wordItem.chunk ||
        '',
    };

    setStudyWords(words);
    setStudyIndex(index);
    setFlashcard(normalizedWord);
    setStep(1);
    setRecallChoice('');
    setFillAnswer('');
    setFillFeedback('');
    setFillCorrect(false);
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
      const [payload, dailyPayload] = await Promise.all([
        getFlashcardData({ word, childId: selectedChildId }),
        requestedWord
          ? getDailyWords({
              childId: selectedChildId,
              limit: safeRequestedWordTotal || DAILY_TARGET,
              world: requestedWorldId,
              stage: hasRequestedStage ? requestedStage : undefined,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);
      const dailyWords = dailyPayload?.words || [];
      const matchedIndex = dailyWords.findIndex((item) => (
        String(item.word || '').toLowerCase() === String(payload.word || word).toLowerCase()
        || String(item.id || '') === String(payload.id || '')
      ));
      const sequenceIndex = matchedIndex >= 0
        ? matchedIndex
        : Math.min(safeRequestedWordIndex, Math.max(0, dailyWords.length - 1));
      const sequenceWords = dailyWords.length ? [...dailyWords] : [payload];
      sequenceWords[sequenceIndex] = {
        ...sequenceWords[sequenceIndex],
        ...payload,
      };
      showStudyWord(payload, sequenceIndex, sequenceWords);
    } catch (err) {
      setStudyError(err.message);
    } finally {
      setStudyLoading(false);
    }
  };

  const loadReviewQuiz = async () => {
    setReviewLoading(true);
    setReviewError(null);
    setReviewData(null);
    setMode('review');
    try {
      let stageAttemptId = '';
      if (hasRequestedStage) {
        const attemptStorageKey = getStageQuizAttemptStorageKey(selectedChildId, requestedWorldId, requestedStage);
        stageAttemptId = localStorage.getItem(attemptStorageKey) || createStageQuizAttemptId();
        localStorage.setItem(attemptStorageKey, stageAttemptId);
      }
      const payload = await getTodayReviewQuiz(selectedChildId, {
        world: hasRequestedStage ? requestedWorldId : undefined,
        stage: hasRequestedStage ? requestedStage : undefined,
        attemptId: hasRequestedStage ? stageAttemptId : undefined,
      });
      setReviewData(payload);
      setReviewIndex(0);
      setReviewAnswer('');
      setReviewLocked(false);
      setReviewScore(0);
      setReviewStreak(0);
      setReviewResult(null);
      setReviewAnswers({});
      setReviewRetryQueue([]);
      setStageReviewQuestions(hasRequestedStage ? (payload.questions || []) : []);
      reviewAttemptIdRef.current = hasRequestedStage
        ? (payload.attempt_id || stageAttemptId)
        : createStageQuizAttemptId();
    } catch (err) {
      setReviewError(err.message || 'Stage Quizを読み込めませんでした。もう一度ためしてください。');
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
  }, [selectedChildId, requestedWord, requestedWorldId, requestedStage, shouldLoadReviewQuiz]);

  const showStudyComplete = () => {
    setMode('complete');
    setFlashcard(null);
    setStep(1);
    setRecallChoice('');
    setFillAnswer('');
    setFillFeedback('');
    setFillCorrect(false);
    setStudyEmpty(false);
    setStudyLoading(false);
  };

const handleNextStudy = async () => {
  if (!flashcard) return;

  try {
    const result = await markMastered({
      word: flashcard.word,
      childId: selectedChildId,
      vocabId: flashcard.id,
    });

    const dailyTarget = Number(result?.target ?? homeData?.target ?? DAILY_TARGET) || DAILY_TARGET;
    const reportedProgress = Number(result?.progress);

    const nextProgress =
      Number.isFinite(reportedProgress)
        ? reportedProgress
        : progressValue + 1;

    setHomeData((prev) => ({
      ...(prev || {}),
      progress: nextProgress,
      target: dailyTarget,
      remain: result?.remain ?? Math.max(0, dailyTarget - nextProgress),
    }));

    const nextIndex = studyIndex + 1;

    if (studyWords.length > 0 && nextIndex < studyWords.length) {
      const nextWord = studyWords[nextIndex];

      if (nextWord?.word) {
        try {
          const detailPayload = await getFlashcardData({
            word: nextWord.word,
            childId: selectedChildId,
          });

          const mergedWord = {
            ...nextWord,
            ...detailPayload,
          };

          const nextWords = [...studyWords];
          nextWords[nextIndex] = mergedWord;

          showStudyWord(mergedWord, nextIndex, nextWords);
          return;
        } catch (detailErr) {
          showStudyWord(nextWord, nextIndex, studyWords);
          return;
        }
      }
    }

    await loadReviewQuiz();
  } catch (err) {
    setStudyError(err.message);
  }
};

const handlePreviousStudy = async () => {
  if (studyIndex <= 0 || !studyWords.length) return;

  const prevIndex = studyIndex - 1;
  const prevWord = studyWords[prevIndex];

  if (!prevWord?.word) return;

  try {
    setStudyLoading(true);

    const detailPayload = await getFlashcardData({
      word: prevWord.word,
      childId: selectedChildId,
    });

    const mergedWord = {
      ...prevWord,
      ...detailPayload,
    };

    const nextWords = [...studyWords];
    nextWords[prevIndex] = mergedWord;

    showStudyWord(mergedWord, prevIndex, nextWords);
  } catch (err) {
    showStudyWord(prevWord, prevIndex, studyWords);
  } finally {
    setStudyLoading(false);
  }
};

  const handleSubmitFill = async () => {
    if (!flashcard) return;
    const correct = (flashcard.word || '').trim().toLowerCase();
    const answer = fillAnswer.trim().toLowerCase();
    const isCorrect = Boolean(correct) && correct === answer;
    setFillCorrect(isCorrect);
    setFillFeedback(isCorrect ? 'せいかい！' : `こたえ: ${flashcard.word}`);
    setStep(5);
  };

  const handleReviewChoice = async (choice) => {
    if (!currentReviewQuestion || reviewLocked) return;
    setReviewAnswer(choice);
    setReviewLocked(true);
    const isCorrect = choice === currentReviewQuestion.correct;
    setReviewAnswers((prev) => ({
      ...prev,
      [getReviewAnswerKey(currentReviewQuestion)]: {
        id: currentReviewQuestion.id,
        word: currentReviewQuestion.word,
        type: currentReviewQuestion.type,
        selected: choice,
      },
    }));
    if (isCorrect) {
      setReviewScore((score) => score + 1);
      setReviewStreak((streak) => streak + 1);
    } else {
      setReviewStreak(0);
    }
  };

  const handleReviewNext = async () => {
    if (reviewIndex < reviewTotal - 1) {
      setReviewIndex((index) => index + 1);
      setReviewAnswer('');
      setReviewLocked(false);
      return;
    }
    if (hasRequestedStage) {
      try {
        setReviewLoading(true);
        const stageQuestions = stageReviewQuestions.length ? stageReviewQuestions : (reviewData?.questions || []);
        const wrongQuestions = stageQuestions.filter((question) => {
          const answer = reviewAnswers[getReviewAnswerKey(question)];
          return !answer || answer.selected !== question.correct;
        });
        const stageScore = Math.max(0, stageQuestions.length - wrongQuestions.length);

        if (wrongQuestions.length > 0) {
          setReviewRetryQueue(wrongQuestions);
          setReviewResult({
            passed: false,
            score: stageScore,
            total: stageQuestions.length || reviewTotal,
            wrongCount: wrongQuestions.length,
            retryQueue: wrongQuestions,
          });
          setMode('review-result');
          return;
        }

        const result = await submitStageQuizAttempt({
          childId: selectedChildId,
          world: requestedWorldId,
          stage: requestedStage,
          attemptId: reviewAttemptIdRef.current,
          answers: Object.values(reviewAnswers),
        });
        localStorage.removeItem(getStageQuizAttemptStorageKey(selectedChildId, requestedWorldId, requestedStage));
        const rewardQueue = Array.isArray(result.reward_queue) ? result.reward_queue : [];
        if (result.passed) {
          if (rewardQueue.length) {
            savePendingRewardQueue(rewardQueue.map((reward) => ({
              ...reward,
              worldId: reward.worldId || reward.world_id || requestedWorldId,
            })));
            navigate('/card-reward');
            return;
          }
          navigate(`${routePrefix}/world-stage?world=${encodeURIComponent(requestedWorldId)}`);
          return;
        }
        setReviewResult({
          passed: false,
          score: Number(result.score || 0),
          total: Number(result.total || reviewTotal),
          stageCleared: Boolean(result.stage_cleared),
          attemptId: result.attempt_id,
          rewardQueue,
        });
        setMode('review-result');
      } catch (err) {
        setReviewError(err.message || 'Quiz結果を保存できませんでした。もう一度ためしてください。');
      } finally {
        setReviewLoading(false);
      }
      return;
    }
    const finalScore = reviewScore;
    const passed = reviewTotal > 0 && finalScore >= reviewTotal;
    setReviewResult({ passed, score: finalScore, total: reviewTotal, stageCleared: false });
    setMode('review-result');
  };

  const startWrongQuestionRetry = () => {
    const retryQuestions = reviewRetryQueue.length
      ? reviewRetryQueue
      : (reviewResult?.retryQueue || []);
    if (!retryQuestions.length) return;
    setReviewData((current) => ({
      ...(current || {}),
      questions: retryQuestions,
    }));
    setReviewIndex(0);
    setReviewAnswer('');
    setReviewLocked(false);
    setReviewScore(0);
    setReviewStreak(0);
    setReviewResult(null);
    setMode('review');
  };

  const progressWidth = mode === 'list'
    ? studyWords.length ? '100%' : '0%'
    : mode === 'study'
    ? studyProgressPercent
    : mode === 'review-complete' || progressValue >= DAILY_TARGET
      ? '100%'
      : progressPercent;
/*   const questNavItems = [
    { label: '\u30db\u30fc\u30e0', to: '/app', icon: 'home' },
    { label: '\u5730\u56f3', to: '/app/study-map', icon: 'map' },
    { label: '\u5b66\u7fd2', to: `${routePrefix}/learning-hub`, icon: 'study', active: true },
    { label: '\u30ab\u30fc\u30c9', to: `${routePrefix}/flashcard`, icon: 'cards' },
    { label: '\u305d\u306e\u4ed6', to: '/settings', icon: 'more' },
  ]; */
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
        <button type="button" onClick={() => navigate(`${routePrefix}/quiz`)} className="ghost-button px-4 py-3 text-sm">クイズに進む</button>
      </div>
    </div>
  );
  if (studyError) {
    return (
      <>
        <div className="quest-word-page-wrap lg:hidden">
          <EQMobileShell className="eq-word-study-screen">
            <QuestHeader
              title="単語カード"
              subtitle="通信を確認して、もう一度ためしてください"
              backTo="/app"
              className="quest-word-header"
            />
            <EQCard className="eq-word-card eq-word-empty-card">
              <h1>読み込みに失敗しました</h1>
              <p>{studyError}</p>
              <button type="button" onClick={() => setStudyError(null)} className="eq-gold-button">
                カードに戻る
              </button>
            </EQCard>
            <QuestProgressStepper current="words" />
          </EQMobileShell>
          <EQBottomNav />
        </div>
        <div className="hidden lg:block">
          <WebLearningLayout title="単語カード" subtitle="覚えた単語を広く確認" rightPanel={rightPanel}>
            <div className="panel px-5 py-5 text-sm text-rose-700">{studyError}</div>
          </WebLearningLayout>
        </div>
      </>
    );
  }

  if (reviewError && mode === 'review') {
    return (
      <WebLearningLayout title="単語カード" subtitle="復習クイズ" rightPanel={rightPanel}>
        <div className="panel px-5 py-5 text-sm text-rose-700">{reviewError}</div>
      </WebLearningLayout>
    );
  }

  if (!questWorld) {
    return (
      <>
        <div className="quest-word-page-wrap lg:hidden">
          <EQMobileShell className="eq-word-study-screen">
            <CompactPageHeader
              title="単語を準備中"
              subtitle="正しい世界を読み込んでいます"
              progressText="Loading..."
              helperImage={SPIRIT_IMAGE}
              variant="loading"
            />
            <EQCard className="eq-word-card eq-word-empty-card">
              <h1>Loading...</h1>
              <p>単語カードを準備しています。</p>
            </EQCard>
          </EQMobileShell>
          <EQBottomNav />
        </div>
        <div className="hidden lg:block">
          <WebLearningLayout title="単語を準備中" subtitle="学習データを読み込んでいます" rightPanel={rightPanel}>
            <div className="panel px-5 py-5 text-sm text-[#60709d]">Loading...</div>
          </WebLearningLayout>
        </div>
      </>
    );
  }

  const mobileTotalWords = studyWords.length > 1
    ? studyWords.length
    : Number.isFinite(requestedWordTotal) && requestedWordTotal > 0
      ? requestedWordTotal
      : Number(homeData?.target || DAILY_TARGET);
  const mobileCurrentNumber = studyWords.length > 1
    ? studyIndex + 1
    : Number.isFinite(requestedWordIndex) && requestedWordIndex >= 0
      ? requestedWordIndex + 1
      : 1;
const mobilePartOfSpeech =
  flashcard?.part_of_speech ||
  flashcard?.partOfSpeech ||
  flashcard?.pos ||
  flashcard?.speech ||
  flashcard?.category ||
  flashcard?.Category ||
  flashcard?.type ||
  '品詞';
  const mobileExample = flashcardExampleText;
  const mobileExampleTranslation =
    flashcard?.sentence_jp ||
    flashcard?.example_jp ||
    flashcard?.exampleJa ||
    flashcard?.example_ja ||
    flashcard?.sentenceJa ||
    flashcard?.Example_Japanese ||
    '日本語訳を読み込み中...';
  const mobileMeaning =
    flashcard?.jp ||
    flashcard?.meaningJa ||
    flashcard?.meaning_ja ||
    flashcard?.japanese ||
    flashcard?.Japanese ||
    '意味を読み込み中...';
  const mobilePhrase = flashcard?.phrase || flashcard?.collocation || flashcard?.chunk || (
    flashcard?.word ? `${flashcard.word} a person` : '-'
  );

  return (
    <>
    {(mode === 'study' || mode === 'complete') && (
      <div className="quest-word-page-wrap lg:hidden">
        <EQMobileShell className="eq-word-study-screen">
          <CompactPageHeader
            title="単語カード"
            backgroundImage={studyWorldDisplay.backgroundImage}
            helperImage={SPIRIT_IMAGE}
            guidanceText="意味と例文を見てみよう"
            variant={questWorld?.id || 'wind'}
          />

          {mode === 'complete' ? (
            <EQCard className="eq-word-card eq-word-empty-card">
              <h1>{'\u4eca\u65e5\u306e\u5358\u8a9e\u306f\u5b8c\u4e86\u3057\u307e\u3057\u305f'}</h1>
              <p>{'\u3053\u306e\u307e\u307e\u5fa9\u7fd2\u3059\u308b\u304b\u3001\u5358\u8a9e\u30ea\u30b9\u30c8\u306b\u623b\u3063\u3066\u6b21\u306e\u5192\u967a\u3092\u9078\u3079\u307e\u3059\u3002'}</p>
              <button type="button" onClick={() => navigate(dailyWordsPath)} className="eq-gold-button">
                {'\u5358\u8a9e\u30ea\u30b9\u30c8\u3078'}
              </button>
              <button type="button" onClick={() => navigate(`${routePrefix}/quiz`)} className="eq-gold-button">
                {'\u30af\u30a4\u30ba\u3078\u9032\u3080'}
              </button>
            </EQCard>
          ) : studyEmpty ? (
            <EQCard className="eq-word-card eq-word-empty-card">
              <h1>学習できる単語がありません</h1>
              <p>今日の学習から単語を進めよう。</p>
              <button type="button" onClick={() => navigate(dailyWordsPath)} className="eq-gold-button">
                学習へ
              </button>
            </EQCard>
          ) : studyLoading || !flashcard ? (
            <EQCard className="eq-word-card eq-word-empty-card">
              <h1>読み込み中...</h1>
              <p>単語カードを準備しています。</p>
            </EQCard>
          ) : (
            <>
              <MagicPanel
                className="eq-word-card quest-word-panel"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
              >
                <div className="eq-word-hero-row">
                  <h1 className="eq-word-title">{flashcard.word}</h1>
                  <button
                    type="button"
                    className="eq-word-speaker is-word"
                    onClick={() => playAudio(flashcard.word, audioRef)}
                    aria-label="単語を聞く"
                  >
                    ♪
                  </button>
                </div>
                <div className="eq-word-card-head">
                  <span className="eq-word-pos-badge"> {mobilePartOfSpeech}</span>
                </div>

                <div className="eq-word-meaning-block">
                  <p className="eq-word-label">意味</p>
                  <p className="eq-word-meaning">{mobileMeaning}</p>
                </div>

                <div className="eq-word-phrase-block">
                  <p className="eq-word-label">フレーズ</p>
                  <p className="eq-word-phrase">{mobilePhrase}</p>
                </div>

                <div className="eq-word-example-block">
                  <p className="eq-word-label">例文</p>
                  <div className="eq-word-row-content has-audio">
                    <p className="eq-word-example-en">{mobileExample || '-'}</p>
                    {mobileExample ? (
                      <button
                        type="button"
                        className="eq-word-speaker eq-word-row-speaker"
                        onClick={() => playAudio(mobileExample, audioRef)}
                        aria-label="例文を聞く"
                      >
                        ♪
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="eq-word-translation-block">
                  <p className="eq-word-label">日本語訳</p>
                  <p className="eq-word-example-ja">{mobileExampleTranslation}</p>
                </div>
              </MagicPanel>

              <div className={`eq-word-actions quest-word-actions-two ${studyIndex > 0 ? '' : 'is-first-word'}`}>
                <button
                  type="button"
                  onClick={handlePreviousStudy}
                  className="quest-word-prev-button"
                  disabled={studyIndex <= 0}
                  aria-disabled={studyIndex <= 0}
                >
                  戻る
                </button>

                <GoldQuestButton onClick={handleNextStudy} className="quest-word-next-button">
                  次へ
                </GoldQuestButton>
              </div>
            </>
          )}
          <QuestProgressStepper current="words" />
        </EQMobileShell>
        <EQBottomNav />
      </div>
    )}
        {mode === 'review' && currentReviewQuestion && (
      <PurificationQuizMobile
        worldId={questWorld?.id || 'wind'}
        day={dayLabel.replace('Day ', '')}
        question={currentReviewQuestion}
        questionIndex={reviewIndex}
        questionTotal={reviewTotal}
        selectedChoice={reviewAnswer}
        retryMode={hasRequestedStage && reviewRetryQueue.length > 0 && reviewTotal < (stageReviewQuestions.length || 20)}
        retryRemaining={reviewTotal}
        onChoose={handleReviewChoice}
        onNext={handleReviewNext}
        quizSaving={reviewLoading}
        onPlayAudio={(quizQuestion) => {
          playAudio(
            quizQuestion?.audio_text ||
              quizQuestion?.word?.word ||
              quizQuestion?.word ||
              '',
            audioRef
          );
        }}
      />
    )}
    {mode === 'review-result' && reviewResult && (
      <div className="eq-purify-page lg:hidden">
        <EQMobileShell className="eq-purify-screen">
          <section
            className={`eq-purify-card ${reviewResult.passed ? 'is-clear-result' : 'is-try-again-result'}`}
            style={{
              '--quest-color': reviewResult.passed ? '#9fffdc' : '#ff9a9a',
              '--quest-glow': reviewResult.passed ? 'rgba(110, 255, 210, 0.45)' : 'rgba(255, 120, 140, 0.42)',
              backgroundImage: `linear-gradient(rgba(4,8,24,.42), rgba(4,8,24,.78)), url(${questWorld?.backgroundImage || '/assets/eigo-quest/worlds/wind.png'})`,
            }}
          >
            <div className="eq-purify-header quest-stage-result-header">
              <span>{WORLD_NAME_JA[requestedWorldId] || questWorld?.nameJa || '風の世界'}・Stage {requestedStage || 1}</span>
              <h1>{reviewResult.passed ? 'CLEAR!' : 'TRY AGAIN'}</h1>
              <p>{reviewResult.passed ? 'よくできました！' : 'あと少し！'}</p>
            </div>

            <div className="eq-purify-prompt quest-stage-result-panel">
              <h2>{reviewResult.passed ? 'カードを受け取りましょう。' : 'まちがえた問題だけ、もう一度チャレンジしよう。'}</h2>
              <div className="quest-stage-result-stats">
                <span>正解数 {reviewResult.score} / {reviewResult.total}</span>
                {!reviewResult.passed ? <span>まちがえた問題 {reviewResult.wrongCount || reviewRetryQueue.length}問</span> : null}
              </div>
            </div>

            <button
              type="button"
              className="eq-purify-next"
              onClick={async () => {
                if (reviewResult.passed) {
                  if (reviewResult.rewardQueue?.length) {
                    savePendingRewardQueue(reviewResult.rewardQueue.map((reward) => ({
                      ...reward,
                      worldId: reward.worldId || reward.world_id || requestedWorldId,
                    })));
                    navigate('/card-reward');
                    return;
                  }
                  navigate(
                  `${routePrefix}/world-stage?world=${encodeURIComponent(requestedWorldId)}`
                );
                } else {
                  startWrongQuestionRetry();
                }
              }}
              disabled={reviewLoading}
            >
              {reviewResult.passed ? 'カードを受け取る' : 'まちがえた問題に挑戦'}
            </button>
            {!reviewResult.passed ? (
              <button
                type="button"
                className="quest-stage-result-secondary"
                onClick={() => navigate(dailyWordsPath)}
              >
                単語を確認する
              </button>
            ) : null}
          </section>
        </EQMobileShell>

        <EQBottomNav />
      </div>
    )}
   <div className={mode === 'study' || mode === 'complete' || mode === 'review' || mode === 'review-result' ? 'hidden lg:block' : ''}>
    <WebLearningLayout title="単語カード" subtitle="単語リストとカード学習" rightPanel={rightPanel}>

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
                    <button type="button" onClick={() => navigate(dailyWordsPath)} className="pill-button mt-6 px-6 py-3">
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
                    <button type="button" onClick={() => navigate(dailyWordsPath)} className="pill-button mt-6 px-6 py-3">
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

            {mode === 'complete' && (
              <motion.div
                key="study-complete"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-[#6f7da8]"
              >
                <h2 className="display-font text-2xl font-extrabold text-[#354172]">
                  {'\u4eca\u65e5\u306e\u5358\u8a9e\u306f\u5b8c\u4e86\u3057\u307e\u3057\u305f'}
                </h2>
                <p className="mt-3 text-sm font-bold leading-7">
                  {'\u3053\u306e\u307e\u307e\u5fa9\u7fd2\u3059\u308b\u304b\u3001\u5358\u8a9e\u30ea\u30b9\u30c8\u306b\u623b\u3063\u3066\u6b21\u306e\u5192\u967a\u3092\u9078\u3079\u307e\u3059\u3002'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={() => navigate(dailyWordsPath)} className="ghost-button px-6 py-3">
                    {'\u5358\u8a9e\u30ea\u30b9\u30c8\u3078'}
                  </button>
                  <button type="button" onClick={() => navigate(`${routePrefix}/quiz`)} className="pill-button px-6 py-3">
                    {'\u30af\u30a4\u30ba\u3078\u9032\u3080'}
                  </button>
                </div>
              </motion.div>
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
    </div>
    </>
  );
}
