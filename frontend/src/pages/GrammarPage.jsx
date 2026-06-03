import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WebLearningLayout from '../components/WebLearningLayout';
import {
  AudioButton,
  EQBottomNav,
  GoldQuestButton,
  MagicPanel,
} from '../components/eigo';
import {
  getGrammarLesson,
  getGrammarLessons,
  markGrammarLessonViewed,
  submitGrammarQuizAnswer,
} from '../api';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

const CHILD_STORAGE_KEY = 'selected_child_id';

function statusLabel(status) {
  if (status === 'mastered') return 'できた';
  if (status === 'learning') return '学習中';
  return 'これから';
}

function statusClass(status) {
  if (status === 'mastered') return 'bg-[#eefbf1] text-[#2f6b42]';
  if (status === 'learning') return 'bg-[#fff7d6] text-[#6b5a2d]';
  return 'bg-[#eef8ff] text-[#51688f]';
}

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

function speak(text, lang = 'en-US') {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}

export default function GrammarPage() {
  const navigate = useNavigate();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total: 0, mastered: 0, learning: 0, remaining: 0, dailyTarget: 1 });
  const [activeLessonId, setActiveLessonId] = useState('');
  const [availableLessonId, setAvailableLessonId] = useState('');
  const [lesson, setLesson] = useState(null);
  const [mode, setMode] = useState('learn');
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeQuiz = lesson?.quizzes?.[quizIndex] || null;
  const quizCount = lesson?.quizzes?.length || 0;
  const isLastQuiz = quizIndex >= quizCount - 1;
  const progressPercent = stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const grammarPoints = (lesson?.points || lesson?.keyPoints || [
    'すでに終わったこと（完了）を表すよ。',
    'したことがある経験（経験）も表せるよ。',
    'already / yet / just などと一緒によく使う。',
  ]).slice(0, 3);

  const refreshLessons = () => (
    getGrammarLessons(childId).then((payload) => {
      const nextLessons = payload.lessons || [];
      setLessons(nextLessons);
      setStats(payload.stats || {});
      setAvailableLessonId(payload.todayLesson?.lessonId || nextLessons[0]?.lessonId || '');
      const nextActive = activeLessonId || payload.todayLesson?.lessonId || nextLessons[0]?.lessonId || '';
      setActiveLessonId(nextActive);
      return nextActive;
    })
  );

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }
    setLoading(true);
    refreshLessons()
      .catch((err) => setError(err.message || '文法レッスンを読み込めませんでした。'))
      .finally(() => setLoading(false));
  }, [childId, navigate]);

  useEffect(() => {
    if (!childId || !activeLessonId) return;
    setDetailLoading(true);
    setMode('learn');
    setQuizIndex(0);
    setSelectedIndex(null);
    setAnswerResult(null);
    getGrammarLesson({ childId, lessonId: activeLessonId })
      .then((payload) => setLesson(payload.lesson))
      .catch((err) => setError(err.message || 'レッスンを読み込めませんでした。'))
      .finally(() => setDetailLoading(false));
  }, [activeLessonId, childId]);

  const handleStartLesson = () => {
    if (!lesson) return;
    setDetailLoading(true);
    markGrammarLessonViewed({ childId, lessonId: lesson.lessonId })
      .then((payload) => {
        setLesson(payload.lesson);
        setMode('quiz');
        return refreshLessons();
      })
      .catch((err) => setError(err.message || '学習を記録できませんでした。'))
      .finally(() => setDetailLoading(false));
  };

  const handleGoPractice = () => {
    if (!lesson) return;
    const lessonId = lesson.lessonId;
    setDetailLoading(true);
    markGrammarLessonViewed({ childId, lessonId })
      .then((payload) => {
        setLesson(payload.lesson);
        return refreshLessons();
      })
      .then(() => navigate(`/grammar-practice?lessonId=${encodeURIComponent(lessonId)}`))
      .catch((err) => setError(err.message || '学習を記録できませんでした。'))
      .finally(() => setDetailLoading(false));
  };

  const handleAnswer = () => {
    if (!activeQuiz || selectedIndex === null || submitting || answerResult) return;
    setSubmitting(true);
    submitGrammarQuizAnswer({ childId, quizId: activeQuiz.quizId, selectedIndex })
      .then((payload) => {
        setAnswerResult(payload);
        setLesson(payload.lesson || lesson);
        return refreshLessons();
      })
      .catch((err) => setError(err.message || '答えを保存できませんでした。'))
      .finally(() => setSubmitting(false));
  };

  const goNextLesson = () => {
    const currentIndex = lessons.findIndex((item) => item.lessonId === activeLessonId);
    const next = lessons.slice(currentIndex + 1).find((item) => item.progress?.status !== 'mastered')
      || lessons[currentIndex + 1]
      || lessons[0];
    if (next) setActiveLessonId(next.lessonId);
  };

  const goNextQuiz = () => {
    if (!isLastQuiz) {
      setQuizIndex((current) => current + 1);
      setSelectedIndex(null);
      setAnswerResult(null);
    }
  };

  if (loading) {
    return (
      <>
        <WebLearningLayout title="文法練習" subtitle="1日1レッスン" mobileTight hideMobileHeader>
          <div className="quest-grammar-learn-page lg:hidden">
            <CompactPageHeader
              title="文法学習"
              subtitle="ことばの使い方を学ぼう"
              backgroundImage="/assets/eigo-quest/learning-hub/文法練習.png"
              elementLabel="文"
              progressText="0 / 0"
              helperImage="/assets/eigo-quest/spirit_assets/happy.png"
              variant="grammar"
            />
            <section className="eq-grammar-learning-card is-loading">
              <span className="eq-grammar-learning-badge">今日の文法</span>
              <h2>文法を読み込み中...</h2>
              <p>魔法図書館で今日のレッスンを準備しています。</p>
            </section>
          </div>
          <div className="panel hidden p-6 text-center font-bold text-[#6f7da8] lg:block">文法レッスンを準備しています...</div>
        </WebLearningLayout>
        <EQBottomNav />
      </>
    );
  }

  return (
    <>
      <WebLearningLayout title="文法練習" subtitle="1日1レッスン" mobileTight hideMobileHeader>
        {error && <div className="panel mb-4 p-5 text-sm font-bold text-rose-700">{error}</div>}

        <div className="quest-grammar-learn-page lg:hidden">
          <CompactPageHeader
            title="文法学習"
            subtitle="ことばの使い方を学ぼう"
            backgroundImage="/assets/eigo-quest/learning-hub/文法練習.png"
            elementLabel="文"
            progressText={`${stats.mastered || 0} / ${stats.total || 0}`}
            helperImage="/assets/eigo-quest/spirit_assets/happy.png"
            variant="grammar"
          />

          {detailLoading || !lesson ? (
            <MagicPanel className="eq-grammar-learning-card is-loading">
              <span className="eq-grammar-learning-badge">今日の文法</span>
              <h2>文法を読み込み中...</h2>
              <p>魔法図書館で今日のレッスンを準備しています。</p>
            </MagicPanel>
          ) : (
            <MagicPanel
              className="eq-grammar-learning-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
            >
              <span className="eq-grammar-learning-badge">今日の文法</span>
              <h2>{lesson.title || '今日の文法'}</h2>
              <p className="eq-grammar-learning-rule">
                {lesson.grammarPoint ? `『${lesson.grammarPoint}』で、経験・完了・継続を表すよ。` : '文のルールを見つけて、英語の使い方を覚えよう。'}
              </p>

              <div className="eq-grammar-example-card">
                <button type="button" onClick={() => speak(lesson.enExample)} aria-label="例文を聞く" className="eq-grammar-play-button">
                  <span aria-hidden="true">▶</span>
                </button>
                <div>
                  <p>{lesson.enExample || 'I have finished my homework.'}</p>
                  <span>{lesson.jpExample || '私は宿題を終えました。'}</span>
                </div>
              </div>

              <div className="eq-grammar-point-card">
                <h3>ポイント</h3>
                <ul>
                  {grammarPoints.map((point) => (
                    <li key={String(point)}>{String(point)}</li>
                  ))}
                </ul>
              </div>

              <div className="eq-grammar-learning-actions">
                <AudioButton onClick={() => speak(lesson.enExample)}>
                  例文を聞く
                </AudioButton>
                <GoldQuestButton onClick={handleGoPractice} disabled={detailLoading} className="eq-grammar-test-button">
                  テストへ進む
                </GoldQuestButton>
              </div>
            </MagicPanel>
          )}

        </div>

      <div className="mb-4 hidden gap-2 overflow-x-auto pb-2 lg:flex">
        {lessons.map((item) => {
          const isMastered = item.progress?.status === 'mastered';
          const isAvailable = item.lessonId === availableLessonId;
          const canOpen = isMastered || isAvailable;
          const isActive = activeLessonId === item.lessonId;
          return (
            <button
              key={item.lessonId}
              type="button"
              disabled={!canOpen}
              onClick={() => {
                if (canOpen) setActiveLessonId(item.lessonId);
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black shadow-sm transition ${
                isActive
                  ? 'border-[#ffd45a] bg-[#fff7d6] text-[#31406f]'
                  : canOpen
                    ? 'border-white/80 bg-white/82 text-[#51688f]'
                    : 'border-white/60 bg-white/50 text-[#9ca8bc] opacity-70'
              }`}
            >
              {item.title}{canOpen ? '' : ' 🔒'}
            </button>
          );
        })}
      </div>

      <section className="hidden overflow-hidden rounded-[34px] border border-white/90 bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-5 shadow-[0_18px_44px_rgba(145,177,209,0.16)] sm:p-7 max-md:rounded-[24px] max-md:p-3 lg:block">
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 max-md:hidden">
            <div className="rounded-[28px] bg-white/82 p-5 shadow-[0_12px_26px_rgba(145,177,209,0.10)]">
              <p className="text-xs font-black text-[#8fa0c2]">今日の文法</p>
              <h1 className="display-font mt-1 text-3xl font-black text-[#31406f]">1日1レッスン</h1>
              <p className="mt-3 text-sm font-bold leading-6 text-[#60709d]">
                説明を読んで、例文を見て、最後に1問だけ確認します。
              </p>
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-black text-[#61759e]">
                  <span>進み具合</span>
                  <span>{stats.mastered || 0} / {stats.total || 0}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#e8eef8]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#91e7a8,#ffd45a)] transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {lessons.map((item) => {
                const isMastered = item.progress?.status === 'mastered';
                const isAvailable = item.lessonId === availableLessonId;
                const canOpen = isMastered || isAvailable;
                return (
                  <button
                    key={item.lessonId}
                    type="button"
                    disabled={!canOpen}
                    onClick={() => {
                      if (canOpen) setActiveLessonId(item.lessonId);
                    }}
                    className={`w-full rounded-[24px] border px-4 py-4 text-left shadow-[0_10px_22px_rgba(145,177,209,0.08)] transition ${
                      activeLessonId === item.lessonId
                        ? 'border-[#ffd45a] bg-white text-[#31406f]'
                        : canOpen
                          ? 'border-white/80 bg-white/70 text-[#51688f] hover:bg-white/90'
                          : 'border-white/60 bg-white/45 text-[#9ca8bc] opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#8fa0c2]">{item.category}</p>
                        <h2 className="mt-1 text-base font-black leading-6">{item.title}</h2>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                        canOpen ? statusClass(item.progress?.status) : 'bg-[#eef2f8] text-[#8d9ab1]'
                      }`}>
                        {canOpen ? statusLabel(item.progress?.status) : 'ロック'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-[620px] rounded-[30px] bg-white/82 p-5 shadow-[0_12px_30px_rgba(145,177,209,0.10)] sm:p-7 max-md:min-h-0 max-md:rounded-[22px] max-md:p-4">
            {detailLoading || !lesson ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm font-bold text-[#6f7da8]">
                レッスンを読み込んでいます...
              </div>
            ) : (
              <div className="space-y-5 max-md:space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 max-md:rounded-[20px] max-md:bg-white/72 max-md:p-4">
                  <div>
                    <p className="text-sm font-black text-[#8fa0c2]">{lesson.category}</p>
                    <h2 className="display-font mt-1 text-3xl font-black leading-tight text-[#31406f] max-md:text-2xl">{lesson.title}</h2>
                    <p className="mt-2 hidden text-lg font-semibold leading-7 text-[#354172] max-md:block">{lesson.grammarPoint}</p>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-sm font-black ${statusClass(lesson.progress?.status)}`}>
                    {statusLabel(lesson.progress?.status)}
                  </span>
                </div>

                <div className="rounded-[26px] bg-[#f8fbff] p-5 max-md:hidden">
                  <p className="text-xs font-black text-[#8fa0c2]">文法ポイント</p>
                  <p className="mt-2 text-2xl font-black leading-9 text-[#354172]">{lesson.grammarPoint}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <article className="rounded-[26px] bg-[#fff8d9] p-5 text-[#665220] max-md:rounded-[20px] max-md:p-4">
                    <h3 className="text-base font-black">どういう意味？</h3>
                    <p className="mt-3 text-sm font-bold leading-7 max-md:text-base">{lesson.jpExplanation}</p>
                  </article>
                  <article className="rounded-[26px] bg-[#eef8ff] p-5 text-[#354172] max-md:rounded-[20px] max-md:p-4">
                    <h3 className="text-base font-black">今日できるようになること</h3>
                    <p className="mt-3 text-sm font-bold leading-7 max-md:text-base">{lesson.learningGoal}</p>
                  </article>
                </div>

                <div className="rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(132,173,222,0.16)] max-md:rounded-[20px] max-md:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-black text-[#354172]">例文</h3>
                    <button
                      type="button"
                      onClick={() => speak(lesson.enExample)}
                      className="ghost-button px-4 py-2 text-sm max-md:px-3 max-md:py-2"
                    >
                      例文を聞く
                    </button>
                  </div>
                  <p className="mt-3 text-xl font-black leading-8 text-[#31406f] max-md:text-lg">{lesson.enExample}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#60709d]">{lesson.jpExample}</p>
                </div>

                {mode === 'learn' && (
                  <div className="rounded-[28px] bg-[#f8fbff] p-5 max-md:rounded-[20px] max-md:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="display-font text-2xl font-black text-[#31406f] max-md:text-xl">まずはここまで</h3>
                        <p className="mt-2 text-sm font-bold leading-6 text-[#60709d]">
                          文法ポイントと例文を読めたら、確認クイズに進みましょう。
                        </p>
                      </div>
                      <button type="button" onClick={handleStartLesson} className="pill-button px-6 py-3 text-sm max-md:min-h-12 max-md:w-full max-md:text-base">
                        練習へ進む
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'quiz' && activeQuiz && (
                  <section className="rounded-[28px] bg-[#f8fbff] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="display-font text-2xl font-black text-[#31406f]">確認クイズ</h3>
                      <span className="rounded-full bg-white/82 px-4 py-2 text-xs font-black text-[#61759e]">
                        {quizIndex + 1} / {quizCount}
                      </span>
                    </div>
                    <p className="mt-4 text-lg font-black leading-8 text-[#354172]">{activeQuiz.questionJp}</p>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {activeQuiz.choices.map((choice, index) => (
                        <button
                          key={`${activeQuiz.quizId}-${choice}`}
                          type="button"
                          disabled={Boolean(answerResult)}
                          onClick={() => setSelectedIndex(index)}
                          className={`flex min-h-[86px] items-center gap-3 rounded-[22px] border-2 px-4 py-3 text-left text-sm font-bold leading-6 transition sm:text-base ${optionClass({
                            index,
                            selectedIndex,
                            result: answerResult,
                          })}`}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/86 text-xs font-black">
                            {String.fromCharCode(65 + index)}
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
                          <p className="text-lg font-black">
                            {answerResult.isCorrect ? 'よくできました！' : 'もう一度見れば大丈夫'}
                          </p>
                          <p className="mt-2 text-sm font-bold leading-6">{answerResult.explanationJp}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {answerResult.isCorrect && !isLastQuiz && (
                            <button type="button" onClick={goNextQuiz} className="pill-button px-5 py-3">
                              次の問題へ
                            </button>
                          )}
                          {answerResult.isCorrect && isLastQuiz && (
                            <button type="button" onClick={goNextLesson} className="pill-button px-5 py-3">
                              次の文法へ
                            </button>
                          )}
                          {!answerResult.isCorrect && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIndex(null);
                                setAnswerResult(null);
                              }}
                              className="ghost-button px-5 py-3"
                            >
                              もう一度
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </main>
        </div>
      </section>
      </WebLearningLayout>
      <EQBottomNav />
    </>
  );
}
