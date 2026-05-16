import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addPokemonExp, getChildren, getDailyWords, getHomeData, markMastered, submitPracticeAnswer } from '../api';
import { getPartner } from '../utils/childStorage';

const DEFAULT_DAILY_WORD_TARGET = 20;
const DAILY_PASS_EXP = 20;

const PARTNER_JA = {
  bulbasaur: 'フシギダネ',
  charmander: 'ヒトカゲ',
  squirtle: 'ゼニガメ',
};

const CHILD_STORAGE_KEY = 'selected_child_id';

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function speak(text, lang = 'en-US') {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function getPartnerName(child, partner) {
  return PARTNER_JA[child?.partnerMonsterId] || partner?.name || 'パートナー';
}

function getPartnerImage(child, partner) {
  return partner?.imageUrl || partner?.image_url || '';
}

const IMPORTANCE_ORDER = { A: 0, B: 1, C: 2 };
const PART_OF_SPEECH_ORDER = [
  ['動詞', 'verb', 'v.'],
  ['形容詞', 'adjective', 'adj.'],
  ['名詞', 'noun', 'n.'],
];

function getImportanceRank(word) {
  return IMPORTANCE_ORDER[String(word.importance || '').trim().toUpperCase()] ?? 9;
}

function getPartOfSpeechRank(word) {
  const value = String(word.partOfSpeech || '').toLowerCase();
  const index = PART_OF_SPEECH_ORDER.findIndex((terms) => terms.some((term) => value.includes(term.toLowerCase())));
  return index >= 0 ? index : 9;
}

function compareLearningOrder(a, b) {
  return (
    Number(a.hasStudied) - Number(b.hasStudied) ||
    getImportanceRank(a) - getImportanceRank(b) ||
    getPartOfSpeechRank(a) - getPartOfSpeechRank(b) ||
    Number(a.id) - Number(b.id)
  );
}

function compareReviewOrder(a, b) {
  return (
    Number(a.familiarity || 0) - Number(b.familiarity || 0) ||
    Number(b.wrongCount || 0) - Number(a.wrongCount || 0) ||
    getImportanceRank(a) - getImportanceRank(b) ||
    getPartOfSpeechRank(a) - getPartOfSpeechRank(b) ||
    Number(a.id) - Number(b.id)
  );
}

function selectBaseWords(allWords) {
  return [...allWords];
}

function getUnitWords(baseWords, unitIndex, targetCount = DEFAULT_DAILY_WORD_TARGET) {
  if (!baseWords.length) return [];
  const safeTargetCount = Math.max(1, Number(targetCount) || DEFAULT_DAILY_WORD_TARGET);
  const start = unitIndex * safeTargetCount;
  if (start < baseWords.length) return baseWords.slice(start, start + safeTargetCount);
  return baseWords.slice(0, safeTargetCount);
}

function buildCloze(sentence, word) {
  if (!sentence || !word) return '';
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withBoundary = sentence.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '______');
  if (withBoundary !== sentence) return withBoundary;
  return sentence.replace(new RegExp(escaped, 'i'), '______');
}

function buildQuizQuestions(words, choiceSource = words) {
  const targets = shuffle(words);
  return targets.map((word, index) => {
    const clozeSentence = buildCloze(word.exampleEn || '', word.word);
    const type = clozeSentence ? ['en-ja', 'ja-en', 'cloze'][index % 3] : index % 2 === 0 ? 'en-ja' : 'ja-en';
    const correct = type === 'en-ja' ? word.meaningJa : word.word;
    const pool = choiceSource
      .filter((item) => item.id !== word.id)
      .map((item) => (type === 'en-ja' ? item.meaningJa : item.word))
      .filter(Boolean);
    const choices = shuffle([correct, ...shuffle(pool).slice(0, 3)]).slice(0, 4);

    return {
      id: `${word.id}-${type}`,
      word,
      type,
      question:
        type === 'en-ja'
          ? `${word.word} の意味はどれ？`
          : type === 'cloze'
            ? `空欄に入る単語はどれ？\n${clozeSentence}`
            : `「${word.meaningJa}」は英語でどれ？`,
      correct,
      choices,
    };
  });
}

export default function DailyWordUnitPage() {
  const navigate = useNavigate();
  const selectedChildId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const [child, setChild] = useState(null);
  const partner = child ? getPartner(child.partnerMonsterId || child.starter_pokemon_id) : null;
  const [stage, setStage] = useState('preview');
  const [allWords, setAllWords] = useState([]);
  const [unitIndex, setUnitIndex] = useState(0);
  const [studyIndex, setStudyIndex] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedChoice, setSelectedChoice] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [earnedExp, setEarnedExp] = useState(0);
  const [partnerExp, setPartnerExp] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(DEFAULT_DAILY_WORD_TARGET);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedChildId) {
      navigate('/select-child', { replace: true });
      return;
    }

    let cancelled = false;
    getChildren()
      .then((payload) => {
        const selected = (payload.children || []).find((item) => String(item.id) === String(selectedChildId));
        if (!selected) {
          navigate('/select-child', { replace: true });
          return null;
        }
        if (!cancelled) {
          setChild(selected);
          setDailyTarget(Math.max(1, Number(selected.daily_target) || DEFAULT_DAILY_WORD_TARGET));
        }
        const target = Math.max(1, Number(selected.daily_target) || DEFAULT_DAILY_WORD_TARGET);
        return Promise.all([
          getDailyWords({ childId: selected.id, limit: target }),
          getHomeData(selected.id).catch(() => null),
        ]);
      })
      .then((result) => {
        if (cancelled || !result) return;
        const [dailyPayload, homePayload] = result;
        setDailyTarget(Math.max(1, Number(dailyPayload.targetWordCount || homePayload?.target) || DEFAULT_DAILY_WORD_TARGET));
        const words = selectBaseWords(dailyPayload.words || []);
        setAllWords(words);
        setPartnerExp(Number(homePayload?.pet?.total_exp ?? homePayload?.pet?.exp ?? 0));
      })
      .catch((err) => {
        setError(err.message || '単語データを読み込めませんでした。');
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, selectedChildId]);

  const todayWords = useMemo(() => getUnitWords(allWords, unitIndex, dailyTarget), [allWords, unitIndex, dailyTarget]);
  const currentWord = todayWords[studyIndex] || null;
  const currentQuestion = quizQuestions[quizIndex] || null;
  const correctCount = answers.filter((answer) => answer.correct).length;
  const wrongAnswers = answers.filter((answer) => !answer.correct);
  const targetCount = todayWords.length || dailyTarget;
  const partnerName = getPartnerName(child, partner);
  const partnerImage = getPartnerImage(child, partner);
  const progressPercent = todayWords.length ? ((studyIndex + 1) / todayWords.length) * 100 : 0;

  const startStudy = () => {
    setStage('study');
    setStudyIndex(0);
  };

  const nextStudyWord = () => {

    if (studyIndex >= todayWords.length - 1) {
      setQuizQuestions(buildQuizQuestions(todayWords, allWords));
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
    const correct = choice === currentQuestion.correct;
    setSelectedChoice(choice);
    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        wordId: currentQuestion.word.id,
        word: currentQuestion.word.word,
        meaningJa: currentQuestion.word.meaningJa,
        selected: choice,
        correctAnswer: currentQuestion.correct,
        correct,
      },
    ]);
  };

  const finishQuiz = async () => {
    const passed = correctCount === quizQuestions.length;
    const exp = passed ? DAILY_PASS_EXP : 0;
    let nextPartnerExp = partnerExp;
    try {
      await Promise.all(answers.map((answer) => {
        const payload = {
          id: answer.wordId,
          word: answer.word,
          selected: answer.selected,
          correct: answer.correctAnswer,
          childId: child.id,
        };
        return answer.correct
          ? markMastered({ word: answer.word, childId: child.id, vocabId: answer.wordId })
          : submitPracticeAnswer(payload);
      }));
    } catch (err) {
      setError(err.message || '学習結果を保存できませんでした。');
      return;
    }
    if (passed) {
      try {
        const payload = await addPokemonExp(child.id, exp);
        nextPartnerExp = Number(payload?.pet?.total_exp ?? payload?.pet?.exp ?? nextPartnerExp);
      } catch (err) {
        setError(err.message || 'EXPを保存できませんでした。');
        return;
      }
    }

    setEarnedExp(exp);
    setPartnerExp(nextPartnerExp);
    setResultStatus(passed ? 'passed' : 'failed');
    setStage('result');
  };

  const nextQuiz = () => {
    if (quizIndex >= quizQuestions.length - 1) {
      finishQuiz();
      return;
    }
    setQuizIndex((index) => index + 1);
    setSelectedChoice('');
  };

  const retryWrongWords = () => {
    const wrongIds = new Set(wrongAnswers.map((answer) => String(answer.wordId)));
    const wrongWords = todayWords.filter((word) => wrongIds.has(String(word.id)));
    setQuizQuestions(buildQuizQuestions(wrongWords, allWords));
    setQuizIndex(0);
    setAnswers([]);
    setSelectedChoice('');
    setResultStatus('');
    setEarnedExp(0);
    setStage('quiz');
  };

  const retryQuiz = () => {
    setQuizQuestions(buildQuizQuestions(todayWords, allWords));
    setQuizIndex(0);
    setAnswers([]);
    setSelectedChoice('');
    setStage('quiz');
  };

  const startNextUnit = () => {
    setUnitIndex((index) => index + 1);
    setStage('preview');
    setStudyIndex(0);
    setQuizQuestions([]);
    setQuizIndex(0);
    setAnswers([]);
    setSelectedChoice('');
    setResultStatus('');
    setEarnedExp(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!child) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-4 sm:px-6">
      <header className="panel mb-4 overflow-hidden px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 rounded-[34px] bg-[linear-gradient(135deg,#fffef8_0%,#eef7ff_55%,#f8fbff_100%)] px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,#fff7be_0%,#ffd94d_100%)] text-xl font-black text-[#5d4700] shadow-[0_12px_22px_rgba(255,193,31,0.24)]">
              PT
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8b9cc4]">Poke-Tan</p>
              <h1 className="display-font mt-1 text-3xl font-black leading-tight text-[#31406f] sm:text-4xl">今日の単語ユニット</h1>
              <p className="mt-1 text-sm font-bold text-[#51658a]">いっしょに英単語を覚えよう</p>
            </div>
          </div>
          <div className="hidden rounded-[22px] border border-white/70 bg-white/85 px-4 py-3 text-sm font-bold text-[#6176aa] sm:block">
            今日<br />
            {new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date())}
          </div>
        </div>
      </header>

      {error && <div className="panel px-6 py-5 text-sm font-bold text-rose-700">{error}</div>}

      {!error && stage === 'preview' && (
        <section className="panel px-6 py-6 sm:px-8">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-6">
            <p className="text-sm font-black text-[#6f7da8]">今日の目標: {targetCount}語</p>
            <h2 className="display-font mt-3 text-3xl font-extrabold text-[#354172]">今日の単語</h2>
            <p className="mt-2 text-sm font-bold text-[#60709d]">{targetCount}個をいっしょに覚えよう</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#61759e]">
              <span className="rounded-full bg-white/82 px-3 py-1">{child.name} さん</span>
              <span className="rounded-full bg-white/82 px-3 py-1">目標: {child.targetLevel}</span>
              <span className="rounded-full bg-[#fff7d6] px-3 py-1">{partnerName} Lv.1</span>
            </div>
          </div>

          <div className="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {todayWords.map((word, index) => (
              <button
                key={`${word.id}-${index}`}
                type="button"
                onClick={() => {
                  setStudyIndex(index);
                  setStage('study');
                }}
                className="rounded-[18px] bg-white/70 px-4 py-3 text-left text-sm font-black text-[#354172] transition hover:-translate-y-0.5 hover:bg-white"
              >
                {index + 1}. {word.word}
                <p className="mt-1 truncate text-xs text-[#6f7da8]">{word.meaningJa}</p>
              </button>
            ))}
          </div>

          <button type="button" onClick={startStudy} disabled={!todayWords.length} className="pill-button mt-8 px-8 py-4 disabled:opacity-40">
            学習をスタート
          </button>
        </section>
      )}

      {!error && stage === 'study' && currentWord && (
        <section className="panel px-6 py-6 sm:px-8">
          <div className="mb-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black text-[#8fa0c2]">Day {unitIndex + 1}</p>
                <h2 className="display-font text-3xl font-black text-[#354172]">
                  {studyIndex + 1} / {todayWords.length} words
                </h2>
              </div>
              <span className="rounded-full bg-[#fff2bb] px-4 py-2 text-xs font-black text-[#6b5a2d]">今日の学習</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e6f4ff]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffe65a,#ffb81f)]" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <article className="rounded-[34px] bg-white/88 p-6 shadow-[0_14px_34px_rgba(145,177,209,0.12)]">
              <p className="inline-flex rounded-full bg-[#eef6ff] px-4 py-2 text-sm font-black text-[#6f7da8]">意味と例文</p>
              <h1 className="display-font mt-6 text-5xl font-extrabold text-[#354172]">{currentWord.word}</h1>
              {currentWord.partOfSpeech && <p className="mt-2 text-sm font-bold text-[#8fa0c2]">{currentWord.partOfSpeech}</p>}
              <p className="mt-5 text-2xl font-black text-[#4f627f]">{currentWord.meaningJa}</p>
              {currentWord.phrase && <p className="mt-5 rounded-[20px] bg-[#fff7d6] px-4 py-3 text-sm font-bold text-[#6b5a2d]">フレーズ: {currentWord.phrase}</p>}
              {currentWord.exampleEn && <p className="mt-7 text-lg font-bold leading-8 text-[#34406f]">英語の例文: {currentWord.exampleEn}</p>}
              {currentWord.exampleJa && <p className="mt-3 text-sm font-bold leading-7 text-[#60709d]">例文の意味: {currentWord.exampleJa}</p>}

              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => speak(currentWord.word)} className="pill-button px-5 py-3 text-sm">
                  単語を聞く
                </button>
                {currentWord.exampleEn && (
                  <button type="button" onClick={() => speak(currentWord.exampleEn)} className="ghost-button px-5 py-3 text-sm">
                    例文を聞く
                  </button>
                )}
                <button type="button" onClick={nextStudyWord} className="ghost-button px-5 py-3 text-sm">
                  {studyIndex >= todayWords.length - 1 ? '小テストへ' : '次へ'}
                </button>
              </div>
            </article>

            <aside className="rounded-[34px] bg-white/82 p-5 text-center shadow-[0_14px_34px_rgba(145,177,209,0.14)]">
              <p className="text-xs font-black text-[#8fa0c2]">今の子ども</p>
              <p className="mt-2 text-lg font-black text-[#354172]">{child.name} さん</p>
              <div className="mt-6 rounded-[30px] bg-[#eef8ff] p-4">
                {partnerImage ? (
                  <img src={partnerImage} alt={partnerName} className="mx-auto h-48 w-48 object-contain" />
                ) : (
                  <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-[28px] bg-white text-4xl font-black text-[#354172]">PT</div>
                )}
              </div>
              <h3 className="display-font mt-4 text-3xl font-black text-[#354172]">{partnerName}</h3>
              <p className="mt-3 rounded-full bg-[#f3f7ff] px-4 py-2 text-sm font-bold text-[#51688f]">今日もいっしょにがんばろう</p>
              <div className="mt-5 rounded-[24px] bg-[#f8fbff] px-4 py-4">
                <div className="flex justify-between text-sm font-bold text-[#6f7da8]">
                  <span>EXP</span>
                  <span>{partnerExp} / 100</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6f4ff]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#bdefff,#83d7ff)]" style={{ width: `${Math.min(100, partnerExp % 100)}%` }} />
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}

      {!error && stage === 'quiz' && currentQuestion && (
        <section className="panel px-6 py-6 sm:px-8">
          <div className="mb-4 flex items-center justify-between text-sm font-black text-[#6f7da8]">
            <span>{quizIndex + 1} / {quizQuestions.length}</span>
            <span>正解 {correctCount}</span>
          </div>
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-6">
            <p className="text-sm font-black text-[#6f7da8]">小テスト</p>
            <h2 className="display-font mt-4 whitespace-pre-line text-3xl font-extrabold text-[#354172]">{currentQuestion.question}</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => speak(currentQuestion.word.word)} className="ghost-button px-5 py-3 text-sm">
                単語を聞く
              </button>
              {currentQuestion.word.exampleEn && (
                <button type="button" onClick={() => speak(currentQuestion.word.exampleEn)} className="ghost-button px-5 py-3 text-sm">
                  例文を聞く
                </button>
              )}
            </div>
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
                {selectedChoice === currentQuestion.correct ? '正解！' : `答え: ${currentQuestion.correct}`}
              </p>
              <p className="mt-1">
                {currentQuestion.word.word} / {currentQuestion.word.meaningJa}
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
              <span className="rounded-full bg-white/82 px-4 py-2">正解数: {correctCount} / {quizQuestions.length}</span>
              <span className="rounded-full bg-[#fff7d6] px-4 py-2">獲得EXP: {earnedExp}</span>
              <span className="rounded-full bg-white/82 px-4 py-2">{partnerName} EXP: {partnerExp}</span>
            </div>
          </div>

          {resultStatus === 'failed' && (
            <div className="mt-5 rounded-[24px] bg-white/78 p-5">
              <p className="font-black text-[#354172]">まちがえた単語</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {wrongAnswers.map((answer) => (
                  <div key={answer.questionId} className="rounded-[18px] bg-[#f8fbff] px-4 py-3 text-sm font-bold text-[#60709d]">
                    {answer.word} / 答え: {answer.correctAnswer}
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
            {resultStatus === 'passed' && (
              <button type="button" onClick={startNextUnit} className="pill-button px-5 py-3">
                次の{dailyTarget}語へ
              </button>
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

