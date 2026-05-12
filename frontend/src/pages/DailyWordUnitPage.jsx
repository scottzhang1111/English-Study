import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import { getDailyWords } from '../api';
import { getCurrentChild, getPartner } from '../utils/childStorage';
import {
  DAILY_PASS_EXP,
  DAILY_PASSING_SCORE,
  DAILY_QUIZ_COUNT,
  DAILY_WORD_TARGET,
  addPartnerExp,
  getDailyLearningRecords,
  getPartnerExp,
  upsertTodayRecord,
} from '../utils/dailyLearningStorage';

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildQuiz(words) {
  const targets = shuffle(words).slice(0, Math.min(DAILY_QUIZ_COUNT, words.length));
  return targets.map((word, index) => {
    const type = index % 2 === 0 ? 'en-ja' : 'ja-en';
    const correct = type === 'en-ja' ? word.meaningJa : word.word;
    const pool = words
      .filter((item) => item.id !== word.id)
      .map((item) => (type === 'en-ja' ? item.meaningJa : item.word))
      .filter(Boolean);
    const choices = shuffle([correct, ...shuffle(pool).slice(0, 3)]).slice(0, 4);
    return {
      id: `${word.id}-${type}`,
      word,
      type,
      question: type === 'en-ja' ? `${word.word} の意味はどれ？` : `「${word.meaningJa}」は英語でどれ？`,
      correct,
      choices,
    };
  });
}

export default function DailyWordUnitPage() {
  const navigate = useNavigate();
  const child = useMemo(() => getCurrentChild(), []);
  const partner = child ? getPartner(child.partnerMonsterId) : null;
  const [stage, setStage] = useState('preview');
  const [todayWords, setTodayWords] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedChoice, setSelectedChoice] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [partnerExp, setPartnerExp] = useState(child ? getPartnerExp(child.id) : 0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!child) {
      navigate('/', { replace: true });
      return;
    }
    getDailyWords(200)
      .then((payload) => {
        const learnedIds = new Set(
          getDailyLearningRecords()
            .filter((record) => record.childId === child.id && record.passed)
            .flatMap((record) => record.studiedWordIds || []),
        );
        const availableWords = (payload.words || []).filter((word) => !learnedIds.has(word.id));
        const words = (availableWords.length >= DAILY_WORD_TARGET ? availableWords : payload.words || []).slice(0, DAILY_WORD_TARGET);
        setTodayWords(words);
        upsertTodayRecord(child.id, {
          targetWordCount: words.length || DAILY_WORD_TARGET,
          studiedWordIds: [],
          passed: false,
        });
      })
      .catch((err) => setError(err.message));
  }, [child, navigate]);

  const currentWord = todayWords[studyIndex] || null;
  const currentQuestion = quizQuestions[quizIndex] || null;
  const correctCount = answers.filter((answer) => answer.correct).length;
  const wrongAnswers = answers.filter((answer) => !answer.correct);
  const targetCount = todayWords.length || DAILY_WORD_TARGET;

  const startStudy = () => {
    setStage('study');
    setStudyIndex(0);
  };

  const nextStudyWord = () => {
    const studiedWordIds = todayWords.slice(0, studyIndex + 1).map((word) => word.id);
    upsertTodayRecord(child.id, {
      targetWordCount: targetCount,
      studiedWordIds,
    });
    if (studyIndex >= todayWords.length - 1) {
      setQuizQuestions(buildQuiz(todayWords));
      setQuizIndex(0);
      setAnswers([]);
      setSelectedChoice('');
      setStage('quiz');
      return;
    }
    setStudyIndex((index) => index + 1);
  };

  const chooseAnswer = (choice) => {
    if (!currentQuestion || selectedChoice) return;
    setSelectedChoice(choice);
    const correct = choice === currentQuestion.correct;
    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        wordId: currentQuestion.word.id,
        word: currentQuestion.word.word,
        selected: choice,
        correctAnswer: currentQuestion.correct,
        correct,
      },
    ]);
  };

  const finishQuiz = (nextAnswers) => {
    const nextCorrectCount = nextAnswers.filter((answer) => answer.correct).length;
    const passed = nextCorrectCount >= DAILY_PASSING_SCORE;
    const wrongWordIds = nextAnswers.filter((answer) => !answer.correct).map((answer) => answer.wordId);
    const earnedExp = passed ? DAILY_PASS_EXP : 0;
    const nextPartnerExp = passed ? addPartnerExp(child.id, earnedExp) : getPartnerExp(child.id);
    setPartnerExp(nextPartnerExp);
    setResultStatus(passed ? 'passed' : 'failed');
    upsertTodayRecord(child.id, {
      targetWordCount: targetCount,
      studiedWordIds: passed ? todayWords.map((word) => word.id) : todayWords.slice(0, studyIndex + 1).map((word) => word.id),
      quizQuestionCount: quizQuestions.length,
      correctCount: nextCorrectCount,
      wrongWordIds,
      passed,
      completedAt: passed ? new Date().toISOString() : '',
      earnedExp,
    });
    setStage('result');
  };

  const nextQuiz = () => {
    const nextAnswers = answers;
    if (quizIndex >= quizQuestions.length - 1) {
      finishQuiz(nextAnswers);
      return;
    }
    setQuizIndex((index) => index + 1);
    setSelectedChoice('');
  };

  const retryWrongWords = () => {
    const wrongIds = new Set(wrongAnswers.map((answer) => answer.wordId));
    const wrongWords = todayWords.filter((word) => wrongIds.has(word.id));
    setTodayWords(wrongWords.length ? wrongWords : todayWords);
    setStudyIndex(0);
    setAnswers([]);
    setSelectedChoice('');
    setStage('study');
  };

  const retryQuiz = () => {
    setQuizQuestions(buildQuiz(todayWords));
    setQuizIndex(0);
    setAnswers([]);
    setSelectedChoice('');
    setStage('quiz');
  };

  if (!child) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="今日の単語ユニット" />
      {error && <div className="panel px-5 py-5 text-sm text-rose-700">{error}</div>}

      {!error && stage === 'preview' && (
        <section className="panel px-6 py-6 sm:px-8">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-6">
            <p className="text-sm font-black text-[#6f7da8]">今日の目標：{targetCount}語</p>
            <h1 className="display-font mt-3 text-3xl font-extrabold text-[#354172]">今日の単語</h1>
            <p className="mt-2 text-sm font-bold text-[#60709d]">{targetCount}個をいっしょに覚えよう</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#61759e]">
              <span className="rounded-full bg-white/82 px-3 py-1">{child.name} さん</span>
              <span className="rounded-full bg-white/82 px-3 py-1">目標：{child.targetLevel}</span>
              {partner && <span className="rounded-full bg-[#fff7d6] px-3 py-1">{partner.name} Lv.1</span>}
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {todayWords.map((word, index) => (
              <div key={word.id || word.word} className="rounded-[18px] bg-white/78 px-4 py-3 text-sm font-bold text-[#354172]">
                {index + 1}. {word.word}
                <p className="mt-1 truncate text-xs text-[#6f7da8]">{word.meaningJa}</p>
              </div>
            ))}
          </div>

          <button type="button" onClick={startStudy} disabled={!todayWords.length} className="pill-button mt-6 px-7 py-4 disabled:opacity-40">
            学習をスタート
          </button>
        </section>
      )}

      {!error && stage === 'study' && currentWord && (
        <section className="panel px-6 py-6 sm:px-8">
          <div className="mb-4 flex items-center justify-between text-sm font-black text-[#6f7da8]">
            <span>{studyIndex + 1} / {todayWords.length}</span>
            <span>{child.name} さん</span>
          </div>
          <article className="rounded-[34px] bg-white/88 p-6 shadow-[0_14px_34px_rgba(145,177,209,0.12)]">
            <p className="text-sm font-black text-[#8fa0c2]">{currentWord.partOfSpeech}</p>
            <h1 className="display-font mt-2 text-5xl font-extrabold text-[#354172]">{currentWord.word}</h1>
            <p className="mt-5 text-2xl font-black text-[#4f627f]">{currentWord.meaningJa}</p>
            {currentWord.meaningZh && <p className="mt-2 text-base font-bold text-[#6f7da8]">中文：{currentWord.meaningZh}</p>}
            {currentWord.phrase && <p className="mt-4 rounded-[20px] bg-[#fff7d6] px-4 py-3 text-sm font-bold text-[#6b5a2d]">{currentWord.phrase}</p>}
            {currentWord.exampleEn && <p className="mt-5 text-lg font-bold leading-8 text-[#34406f]">{currentWord.exampleEn}</p>}
            {currentWord.exampleJa && <p className="mt-2 text-sm font-bold leading-7 text-[#60709d]">{currentWord.exampleJa}</p>}
            {currentWord.exampleZh && <p className="mt-1 text-sm font-bold leading-7 text-[#7b86a8]">{currentWord.exampleZh}</p>}
          </article>
          <button type="button" onClick={nextStudyWord} className="pill-button mt-6 px-7 py-4">
            {studyIndex >= todayWords.length - 1 ? '小テストへ' : '次の単語へ'}
          </button>
        </section>
      )}

      {!error && stage === 'quiz' && currentQuestion && (
        <section className="panel px-6 py-6 sm:px-8">
          <div className="mb-4 flex items-center justify-between text-sm font-black text-[#6f7da8]">
            <span>{quizIndex + 1} / {quizQuestions.length}</span>
            <span>正解 {correctCount}</span>
          </div>
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#6f7da8]">小テスト</p>
            <h2 className="display-font mt-4 text-3xl font-extrabold text-[#354172]">{currentQuestion.question}</h2>
          </div>
          <div className="mt-6 grid gap-3">
            {currentQuestion.choices.map((choice) => {
              const isCorrect = selectedChoice && choice === currentQuestion.correct;
              const isWrong = selectedChoice === choice && choice !== currentQuestion.correct;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => chooseAnswer(choice)}
                  disabled={!!selectedChoice}
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
          {selectedChoice && (
            <div className="mt-5 rounded-[24px] bg-[#f9fcff] p-5 text-sm font-bold leading-7 text-[#60709d]">
              <p className="text-base font-black text-[#354172]">
                {selectedChoice === currentQuestion.correct ? '正解！' : `答え：${currentQuestion.correct}`}
              </p>
              <p className="mt-1">
                {currentQuestion.word.word}：{currentQuestion.word.meaningJa}
              </p>
              {currentQuestion.word.exampleEn && <p className="mt-1">{currentQuestion.word.exampleEn}</p>}
              <button type="button" onClick={nextQuiz} className="pill-button mt-4 px-5 py-3">
                次へ
              </button>
            </div>
          )}
        </section>
      )}

      {!error && stage === 'result' && (
        <section className="panel px-6 py-6 sm:px-8">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-6 text-center">
            <h1 className="display-font text-4xl font-extrabold text-[#354172]">
              {resultStatus === 'passed' ? '今日の単語クリア！' : 'もう少し！'}
            </h1>
            <p className="mt-3 text-sm font-bold leading-7 text-[#60709d]">
              {resultStatus === 'passed'
                ? `${targetCount}個の単語を学習しました。小テストもよくできました。`
                : 'まちがえた単語だけ、もう一度見てみよう。'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm font-black text-[#61759e]">
              <span className="rounded-full bg-white/82 px-4 py-2">正解数：{correctCount} / {quizQuestions.length}</span>
              <span className="rounded-full bg-[#fff7d6] px-4 py-2">獲得EXP：+{resultStatus === 'passed' ? DAILY_PASS_EXP : 0}</span>
              {partner && <span className="rounded-full bg-white/82 px-4 py-2">{partner.name} EXP：{partnerExp}</span>}
            </div>
          </div>

          {resultStatus === 'failed' && (
            <div className="mt-5 rounded-[24px] bg-white/78 p-5">
              <p className="font-black text-[#354172]">まちがえた単語</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {wrongAnswers.map((answer) => (
                  <div key={answer.questionId} className="rounded-[18px] bg-[#f8fbff] px-4 py-3 text-sm font-bold text-[#60709d]">
                    {answer.word} / 答え：{answer.correctAnswer}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {resultStatus === 'failed' && (
              <>
                <button type="button" onClick={retryWrongWords} className="ghost-button px-5 py-3">
                  まちがえた単語をもう一度
                </button>
                <button type="button" onClick={retryQuiz} className="pill-button px-5 py-3">
                  もう一度テストする
                </button>
              </>
            )}
            <button type="button" onClick={() => navigate('/app')} className="ghost-button px-5 py-3">
              ホームへ
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
