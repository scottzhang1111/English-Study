import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import CaptureAnimation from '../components/CaptureAnimation';
import { captureBattleMonster, startBattle, submitBattleAnswer } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function categoryLabel(category) {
  return {
    infinitive: '不定詞',
    gerund: '動名詞',
    comparison: '比較',
    relative_pronoun: '関係代名詞',
    present_perfect: '現在完了',
  }[category] || category;
}

function hpPercent(session) {
  if (!session?.maxHp) return 0;
  return Math.max(0, Math.min(100, (session.monsterHp / session.maxHp) * 100));
}

export default function BattlePage() {
  const [battle, setBattle] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [captureResult, setCaptureResult] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    startBattle({ childId })
      .then((payload) => {
        setBattle(payload.battleSession);
        setQuestions(payload.questions || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [childId]);

  const question = questions[index];
  const isAnswered = Boolean(answerResult);
  const isLast = index >= questions.length - 1;

  const handleAnswer = () => {
    if (!question || !selected || submitting || isAnswered) return;
    setSubmitting(true);
    submitBattleAnswer({
      sessionId: battle.id,
      questionId: question.id,
      selectedAnswer: selected,
    })
      .then((payload) => {
        setAnswerResult(payload);
        setBattle(payload.battleSession);
      })
      .catch((err) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  const handleNext = () => {
    if (!isLast) {
      setIndex((current) => current + 1);
      setSelected('');
      setAnswerResult(null);
      return;
    }
    if (battle?.status === 'capture_ready') {
      return;
    }
    navigate('/review');
  };

  const handleCapture = () => {
    if (!battle || phase !== 'idle') return;
    setPhase('throwing');
    window.setTimeout(() => setPhase('shake'), 760);
    window.setTimeout(() => {
      captureBattleMonster(battle.id)
        .then((payload) => {
          setCaptureResult(payload);
          setBattle(payload.battleSession);
          setPhase('done');
        })
        .catch((err) => {
          setError(err.message);
          setPhase('idle');
        });
    }, 1800);
  };

  const optionClass = (choice) => {
    if (!isAnswered) {
      return selected === choice
        ? 'border-[#ffc940] bg-[#fff7d6] text-[#59430c]'
        : 'border-white/80 bg-white/88 text-[#354172] hover:-translate-y-0.5 hover:bg-white';
    }
    if (choice === answerResult.correctAnswer) return 'border-[#68c783] bg-[#eefbf1] text-[#2f6b42]';
    if (choice === selected && !answerResult.isCorrect) return 'border-[#ff9baa] bg-[#fff0f2] text-[#a94354]';
    return 'border-white/80 bg-white/70 text-[#7d8aa9]';
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
        <HeaderBar subtitle="学習バトル" />
        <div className="panel p-6 text-center font-bold text-[#6f7da8]">バトルを準備しています...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="文法モンスターバトル" />
      {error && <div className="panel mb-4 p-5 text-sm text-rose-700">{error}</div>}

      <section className="rounded-[36px] border border-white/80 bg-white/82 p-5 shadow-[0_18px_44px_rgba(145,177,209,0.16)]">
        {!question ? (
          <div className="rounded-[28px] bg-white/80 p-6 text-center font-bold text-[#6f7da8]">問題を読み込めませんでした。</div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div>
              <CaptureAnimation monster={battle?.monster} phase={phase} result={captureResult?.success ? 'success' : captureResult ? 'failed' : null} />
              <div className="mt-4 rounded-[24px] bg-white/88 p-4">
                <div className="flex items-center justify-between text-sm font-black text-[#51688f]">
                  <span>{battle?.monster?.nameJa || 'モンスター'}</span>
                  <span>{battle?.monsterHp ?? 0} / {battle?.maxHp ?? 100}</span>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#eef2f8]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#91e7a8,#ffd45a)] transition-all" style={{ width: `${hpPercent(battle)}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-black text-[#51688f]">
                  {index + 1} / {questions.length}
                </span>
                <span className="rounded-full bg-[#fff7d6] px-4 py-2 text-sm font-black text-[#6b5a2d]">
                  {categoryLabel(question.category)}
                </span>
              </div>

              <article className="rounded-[28px] bg-[#f8fbff] p-5">
                <h2 className="text-xl font-extrabold leading-8 text-[#354172]">{question.questionText}</h2>
                <div className="mt-4 grid gap-3">
                  {question.choices.map((choice, choiceIndex) => (
                    <button
                      key={choice}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => setSelected(choice)}
                      className={`flex items-center gap-3 rounded-[22px] border-2 px-4 py-3 text-left text-base font-bold shadow-[0_8px_18px_rgba(145,177,209,0.08)] transition ${optionClass(choice)}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/82 text-sm font-black">
                        {String.fromCharCode(65 + choiceIndex)}
                      </span>
                      <span>{choice}</span>
                      {isAnswered && choice === answerResult.correctAnswer && <span className="ml-auto rounded-full bg-white px-3 py-1 text-xs">正解</span>}
                      {isAnswered && choice === selected && !answerResult.isCorrect && <span className="ml-auto rounded-full bg-white px-3 py-1 text-xs">あなたの答え</span>}
                    </button>
                  ))}
                </div>
              </article>

              {!isAnswered ? (
                <button
                  type="button"
                  disabled={!selected || submitting}
                  onClick={handleAnswer}
                  className="pill-button w-full px-6 py-4 text-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? '判定中...' : '回答する'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className={`rounded-[24px] p-4 ${answerResult.isCorrect ? 'bg-[#eefbf1] text-[#2f6b42]' : 'bg-[#fff0f2] text-[#a94354]'}`}>
                    <p className="text-lg font-black">{answerResult.isCorrect ? 'いいね！正解です。' : 'だいじょうぶ。ここで覚えよう。'}</p>
                    <p className="mt-2 text-sm font-bold">正しい答え：{answerResult.correctAnswer}</p>
                  </div>
                  <div className="rounded-[24px] bg-[#fff8d9] p-4 text-[#665220]">
                    <h3 className="font-black">なぜこの答え？</h3>
                    <p className="mt-2 leading-7">{answerResult.explanation || '解説はまだ準備中です。'}</p>
                  </div>

                  {isLast && battle?.status === 'capture_ready' ? (
                    <div className="rounded-[24px] bg-[#eef8ff] p-4 text-center">
                      <p className="font-black text-[#354172]">チャンス！モンスターをつかまえよう。</p>
                      {captureResult ? (
                        <div className="mt-3">
                          <p className="text-lg font-black text-[#354172]">
                            {captureResult.success
                              ? `やった！${captureResult.monster?.nameJa || 'モンスター'} をつかまえた！`
                              : 'もう少し！あと少しでつかまえられそう！'}
                          </p>
                          <div className="mt-4 flex flex-wrap justify-center gap-3">
                            <Link to="/pokedex" className="pill-button px-5 py-3">図鑑で見る</Link>
                            <button type="button" onClick={() => window.location.reload()} className="ghost-button px-5 py-3">次の学習へ</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={handleCapture} className="pill-button mt-3 px-6 py-3">
                          モンスターボールを投げる
                        </button>
                      )}
                    </div>
                  ) : isLast && battle?.status === 'finished' ? (
                    <div className="rounded-[24px] bg-[#fff8d9] p-4 text-center">
                      <p className="font-black text-[#6b5a2d]">もう少し練習しよう。まちがえた問題は復習に入ったよ。</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <Link to="/review" className="pill-button px-5 py-3">復習する</Link>
                        <button type="button" onClick={() => window.location.reload()} className="ghost-button px-5 py-3">もう一度チャレンジ</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={handleNext} className="pill-button w-full px-6 py-4 text-lg">
                      次の問題へ
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
