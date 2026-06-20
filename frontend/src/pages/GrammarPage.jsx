import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WebLearningLayout from '../components/WebLearningLayout';
import {
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

function getLessonValue(lesson, fieldName) {
  if (!lesson) return '';
  if (lesson[fieldName]) return lesson[fieldName];
  const fallbackEntry = Object.entries(lesson).find(([key, value]) => (
    value && String(key).trim().endsWith(fieldName)
  ));
  return fallbackEntry?.[1] || '';
}

function buildGrammarPoints(lesson) {
  const apiPoints = lesson?.points || lesson?.keyPoints;
  if (Array.isArray(apiPoints) && apiPoints.length) return apiPoints.slice(0, 3);

  const grammarPoint = getLessonValue(lesson, 'grammarPoint');
  const jpExplanation = getLessonValue(lesson, 'jpExplanation');

  return [
    lesson?.learningGoal,
    jpExplanation,
    grammarPoint ? `形: ${grammarPoint}` : '',
  ].filter(Boolean).slice(0, 3);
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
  const [patternIndex, setPatternIndex] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [preparingMessage, setPreparingMessage] = useState('');

  const activeQuiz = lesson?.quizzes?.[quizIndex] || null;
  const quizCount = lesson?.quizzes?.length || 0;
  const pre2PatternLessons = lessons.filter((item) => item.level === 'eiken_pre2' && Number(item.patternCount || item.patterns?.length || 0) > 0);
  const pre2ScrollLessons = lessons.filter((item) => item.level === 'eiken_pre2' && Number(item.sectionCount || item.sections?.length || 0) > 0);
  const hasPatternLesson = Number(lesson?.patternCount || lesson?.patterns?.length || 0) > 0;
  const hasScrollLesson = Number(lesson?.sectionCount || lesson?.sections?.length || 0) > 0;
  const lessonPatterns = hasPatternLesson ? (lesson?.patterns || []) : [];
  const activePattern = lessonPatterns[patternIndex] || lessonPatterns[0] || null;
  const lessonSections = hasScrollLesson ? (lesson?.sections || []) : [];
  const activeSection = lessonSections[sectionIndex] || lessonSections[0] || null;
  const isLastQuiz = quizIndex >= quizCount - 1;
  const progressPercent = stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const grammarPoint = getLessonValue(lesson, 'grammarPoint');
  const jpExplanation = getLessonValue(lesson, 'jpExplanation');
  const grammarPoints = buildGrammarPoints(lesson);
  const isLongGrammarTitle = String(lesson?.title || '').length >= 8;

  const refreshLessons = () => (
    getGrammarLessons(childId).then((payload) => {
      const nextPreparingMessage = payload.preparing ? (payload.message || '3級文法は準備中です') : '';
      setPreparingMessage(nextPreparingMessage);
      const nextLessons = payload.lessons || [];
      setLessons(nextLessons);
      setStats(payload.stats || {});
      setAvailableLessonId(payload.todayLesson?.lessonId || nextLessons[0]?.lessonId || '');
      const nextActive = activeLessonId || payload.todayLesson?.lessonId || nextLessons[0]?.lessonId || '';
      setActiveLessonId(nextActive);
      if (!nextActive) setLesson(null);
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
    if (!childId || !activeLessonId || preparingMessage) return;
    setDetailLoading(true);
    setMode('learn');
    setPatternIndex(0);
    setSectionIndex(0);
    setQuizIndex(0);
    setSelectedIndex(null);
    setAnswerResult(null);
    getGrammarLesson({ childId, lessonId: activeLessonId })
      .then((payload) => setLesson(payload.lesson))
      .catch((err) => setError(err.message || 'レッスンを読み込めませんでした。'))
      .finally(() => setDetailLoading(false));
  }, [activeLessonId, childId, preparingMessage]);

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

  const openLesson = (lessonId) => {
    setPatternIndex(0);
    setSectionIndex(0);
    setMode('learn');
    setActiveLessonId(lessonId);
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

  if (preparingMessage) {
    return (
      <>
        <WebLearningLayout title="文法練習" subtitle="1日1レッスン" mobileTight hideMobileHeader>
          <div className="quest-grammar-learn-page lg:hidden">
            <CompactPageHeader
              title="文法学習"
              subtitle="ことばの使い方を学ぼう"
              backgroundImage="/assets/eigo-quest/learning-hub/文法練習.png"
              elementLabel="文"
              progressText="準備中"
              helperImage="/assets/eigo-quest/spirit_assets/happy.png"
              variant="grammar"
            />
            <MagicPanel className="eq-grammar-learning-card">
              <span className="eq-grammar-learning-badge">準備中</span>
              <h2>{preparingMessage}</h2>
              <p>準2級の文法レッスンはこれまで通り使えます。</p>
            </MagicPanel>
          </div>
          <div className="panel hidden p-6 text-center font-bold text-[#6f7da8] lg:block">{preparingMessage}</div>
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

          {pre2PatternLessons.length > 0 && (
            <section className="mb-4 rounded-[24px] border border-[#e7c76a]/70 bg-[#102856] p-4 text-white shadow-[0_16px_34px_rgba(16,40,86,0.24)]">
              <p className="text-xs font-black text-[#ffd86f]">英検準2級</p>
              <h2 className="mt-1 text-xl font-black">高频句型</h2>
              <div className="mt-3 grid gap-3">
                {pre2PatternLessons.map((item) => (
                  <button
                    key={item.lessonId}
                    type="button"
                    onClick={() => openLesson(item.lessonId)}
                    className={`rounded-[18px] border p-4 text-left transition ${
                      activeLessonId === item.lessonId
                        ? 'border-[#ffd86f] bg-white/18'
                        : 'border-white/18 bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">{item.title}</h3>
                        <p className="mt-1 text-xs font-bold text-white/72">{item.learningGoal || item.grammarPoint}</p>
                      </div>
                      <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                        {item.patternCount || item.patterns?.length || 0} 句型
                      </span>
                    </div>
                    <span className="mt-3 inline-flex rounded-full bg-[#ffd86f] px-4 py-2 text-sm font-black text-[#102856]">
                      学習する
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {pre2ScrollLessons.length > 0 && (
            <section className="mb-4 rounded-[24px] border border-[#e7c76a]/70 bg-[#102856] p-4 text-white shadow-[0_16px_34px_rgba(16,40,86,0.24)]">
              <p className="text-xs font-black text-[#ffd86f]">準2級 文法卷轴</p>
              <h2 className="mt-1 text-xl font-black">接続詞・関係詞</h2>
              <div className="mt-3 grid gap-3">
                {pre2ScrollLessons.map((item) => (
                  <button
                    key={item.lessonId}
                    type="button"
                    onClick={() => openLesson(item.lessonId)}
                    className={`rounded-[18px] border p-4 text-left transition ${
                      activeLessonId === item.lessonId
                        ? 'border-[#ffd86f] bg-white/18'
                        : 'border-white/18 bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#ffd86f]">{item.category}</p>
                        <h3 className="mt-1 text-base font-black">{item.title}</h3>
                        <p className="mt-1 text-xs font-bold text-white/72">{item.grammarPoint}</p>
                      </div>
                      <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                        {item.sectionCount || item.sections?.length || 0} 巻
                      </span>
                    </div>
                    <span className="mt-3 inline-flex rounded-full bg-[#ffd86f] px-4 py-2 text-sm font-black text-[#102856]">
                      学習する
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

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
              <h2 className={isLongGrammarTitle ? 'is-long-title' : ''}>{lesson.title || '今日の文法'}</h2>
              <p className="eq-grammar-learning-rule">
                {grammarPoint ? `『${grammarPoint}』を使うルールを確認しよう。` : '文のルールを見つけて、英語の使い方を覚えよう。'}
              </p>

              {hasPatternLesson && activePattern ? (
                <div className="rounded-[22px] border border-[#e7c76a]/70 bg-[#102856] p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                      {patternIndex + 1} / {lessonPatterns.length}
                    </span>
                    <span className="text-xs font-black text-[#ffd86f]">Eiken Pre-2</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-black">{activePattern.pattern}</h3>
                  <p className="mt-3 text-base font-bold text-[#ffd86f]">{activePattern.meaningJa}</p>
                  <div className="mt-4 rounded-[16px] bg-white/10 p-4">
                    <p className="text-lg font-black leading-7">{activePattern.exampleEn}</p>
                    {activePattern.exampleJa ? <p className="mt-2 text-sm font-bold text-white/72">{activePattern.exampleJa}</p> : null}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPatternIndex((current) => Math.max(0, current - 1))}
                      disabled={patternIndex === 0}
                      className="rounded-full border border-white/30 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                    >
                      前へ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatternIndex((current) => Math.min(lessonPatterns.length - 1, current + 1))}
                      disabled={patternIndex >= lessonPatterns.length - 1}
                      className="rounded-full border border-white/30 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                    >
                      次へ
                    </button>
                  </div>
                  <GoldQuestButton onClick={handleGoPractice} disabled={detailLoading} className="mt-4 w-full">
                    テストへ進む
                  </GoldQuestButton>
                </div>
              ) : null}

              {hasScrollLesson && activeSection ? (
                <div className="rounded-[22px] border border-[#e7c76a]/70 bg-[#102856] p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                      {sectionIndex + 1} / {lessonSections.length}
                    </span>
                    <span className="text-xs font-black text-[#ffd86f]">文法卷轴</span>
                  </div>
                  <h3 className="mt-4 text-2xl font-black">{activeSection.smallTitle}</h3>
                  <p className="mt-3 text-sm font-bold leading-6 text-white/82">{activeSection.explanationJa}</p>
                  <div className="mt-4 rounded-[16px] bg-white/10 p-4">
                    <p className="text-lg font-black leading-7">{activeSection.exampleEn}</p>
                    <p className="mt-2 text-sm font-bold text-[#ffd86f]">{activeSection.exampleJa}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSectionIndex((current) => Math.max(0, current - 1))}
                      disabled={sectionIndex === 0}
                      className="rounded-full border border-white/30 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                    >
                      前へ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSectionIndex((current) => Math.min(lessonSections.length - 1, current + 1))}
                      disabled={sectionIndex >= lessonSections.length - 1}
                      className="rounded-full border border-white/30 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                    >
                      次へ
                    </button>
                  </div>
                  <GoldQuestButton onClick={handleGoPractice} disabled={detailLoading} className="mt-4 w-full">
                    テストへ進む
                  </GoldQuestButton>
                </div>
              ) : null}

              <div className={`${hasPatternLesson || hasScrollLesson ? 'hidden ' : ''}eq-grammar-example-card`}>
                <button type="button" onClick={() => speak(lesson.enExample)} aria-label="例文を聞く" className="eq-grammar-play-button">
                  <span aria-hidden="true">▶</span>
                </button>
                <div>
                  <p>{lesson.enExample || 'I have finished my homework.'}</p>
                  <span>{lesson.jpExample || '私は宿題を終えました。'}</span>
                </div>
              </div>

              <div className={`${hasPatternLesson || hasScrollLesson ? 'hidden ' : ''}eq-grammar-point-card`}>
                <h3>ポイント</h3>
                <ul>
                  {grammarPoints.map((point) => (
                    <li key={String(point)}>{String(point)}</li>
                  ))}
                </ul>
              </div>

              <div className={`${hasPatternLesson || hasScrollLesson ? 'hidden ' : ''}eq-grammar-learning-actions`}>
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
            {pre2PatternLessons.length > 0 && (
              <div className="rounded-[28px] border border-[#e7c76a]/70 bg-[#102856] p-5 text-white shadow-[0_12px_26px_rgba(16,40,86,0.18)]">
                <p className="text-xs font-black text-[#ffd86f]">英検準2級</p>
                <h2 className="display-font mt-1 text-2xl font-black">高频句型</h2>
                <div className="mt-4 space-y-3">
                  {pre2PatternLessons.map((item) => (
                    <button
                      key={item.lessonId}
                      type="button"
                      onClick={() => openLesson(item.lessonId)}
                      className={`w-full rounded-[18px] border p-4 text-left transition ${
                        activeLessonId === item.lessonId
                          ? 'border-[#ffd86f] bg-white/18'
                          : 'border-white/18 bg-white/10 hover:bg-white/16'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-black">{item.title}</h3>
                        <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                          {item.patternCount || item.patterns?.length || 0}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold leading-5 text-white/72">{item.learningGoal || item.grammarPoint}</p>
                      <span className="mt-3 inline-flex rounded-full bg-[#ffd86f] px-4 py-2 text-xs font-black text-[#102856]">
                        学習する
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pre2ScrollLessons.length > 0 && (
              <div className="rounded-[28px] border border-[#e7c76a]/70 bg-[#102856] p-5 text-white shadow-[0_12px_26px_rgba(16,40,86,0.18)]">
                <p className="text-xs font-black text-[#ffd86f]">準2級 文法卷轴</p>
                <h2 className="display-font mt-1 text-2xl font-black">接続詞・関係詞</h2>
                <div className="mt-4 space-y-3">
                  {pre2ScrollLessons.map((item) => (
                    <button
                      key={item.lessonId}
                      type="button"
                      onClick={() => openLesson(item.lessonId)}
                      className={`w-full rounded-[18px] border p-4 text-left transition ${
                        activeLessonId === item.lessonId
                          ? 'border-[#ffd86f] bg-white/18'
                          : 'border-white/18 bg-white/10 hover:bg-white/16'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-[#ffd86f]">{item.category}</p>
                          <h3 className="mt-1 text-sm font-black leading-5">{item.title}</h3>
                        </div>
                        <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                          {item.sectionCount || item.sections?.length || 0}
                        </span>
                      </div>
                      <span className="mt-3 inline-flex rounded-full bg-[#ffd86f] px-4 py-2 text-xs font-black text-[#102856]">
                        学習する
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                    <p className="mt-2 hidden text-lg font-semibold leading-7 text-[#354172] max-md:block">{grammarPoint}</p>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-sm font-black ${statusClass(lesson.progress?.status)}`}>
                    {statusLabel(lesson.progress?.status)}
                  </span>
                </div>

                <div className="rounded-[26px] bg-[#f8fbff] p-5 max-md:hidden">
                  <p className="text-xs font-black text-[#8fa0c2]">文法ポイント</p>
                  <p className="mt-2 text-2xl font-black leading-9 text-[#354172]">{grammarPoint}</p>
                </div>

                {hasPatternLesson && activePattern ? (
                  <div className="rounded-[28px] border border-[#e7c76a]/70 bg-[#102856] p-6 text-white shadow-[0_16px_34px_rgba(16,40,86,0.18)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                        {patternIndex + 1} / {lessonPatterns.length}
                      </span>
                      <span className="text-xs font-black text-[#ffd86f]">Eiken Pre-2</span>
                    </div>
                    <h3 className="mt-5 text-4xl font-black leading-tight">{activePattern.pattern}</h3>
                    <p className="mt-4 text-xl font-bold text-[#ffd86f]">{activePattern.meaningJa}</p>
                    <div className="mt-5 rounded-[20px] bg-white/10 p-5">
                      <p className="text-2xl font-black leading-9">{activePattern.exampleEn}</p>
                      {activePattern.exampleJa ? <p className="mt-2 text-sm font-bold text-white/72">{activePattern.exampleJa}</p> : null}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setPatternIndex((current) => Math.max(0, current - 1))}
                        disabled={patternIndex === 0}
                        className="rounded-full border border-white/30 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
                      >
                        前へ
                      </button>
                      <button
                        type="button"
                        onClick={() => setPatternIndex((current) => Math.min(lessonPatterns.length - 1, current + 1))}
                        disabled={patternIndex >= lessonPatterns.length - 1}
                        className="rounded-full border border-white/30 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
                      >
                        次へ
                      </button>
                      <button type="button" onClick={handleStartLesson} className="pill-button px-6 py-3 text-sm">
                        テストへ進む
                      </button>
                    </div>
                  </div>
                ) : null}

                {hasScrollLesson && activeSection ? (
                  <div className="rounded-[28px] border border-[#e7c76a]/70 bg-[#102856] p-6 text-white shadow-[0_16px_34px_rgba(16,40,86,0.18)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#ffd86f] px-3 py-1 text-xs font-black text-[#102856]">
                        {sectionIndex + 1} / {lessonSections.length}
                      </span>
                      <span className="text-xs font-black text-[#ffd86f]">文法卷轴</span>
                    </div>
                    <h3 className="mt-5 text-4xl font-black leading-tight">{activeSection.smallTitle}</h3>
                    <p className="mt-4 text-lg font-bold leading-8 text-white/82">{activeSection.explanationJa}</p>
                    <div className="mt-5 rounded-[20px] bg-white/10 p-5">
                      <p className="text-2xl font-black leading-9">{activeSection.exampleEn}</p>
                      <p className="mt-2 text-sm font-bold text-[#ffd86f]">{activeSection.exampleJa}</p>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setSectionIndex((current) => Math.max(0, current - 1))}
                        disabled={sectionIndex === 0}
                        className="rounded-full border border-white/30 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
                      >
                        前へ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSectionIndex((current) => Math.min(lessonSections.length - 1, current + 1))}
                        disabled={sectionIndex >= lessonSections.length - 1}
                        className="rounded-full border border-white/30 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
                      >
                        次へ
                      </button>
                      <button type="button" onClick={handleGoPractice} className="pill-button px-6 py-3 text-sm">
                        テストへ進む
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className={`${hasPatternLesson || hasScrollLesson ? 'hidden ' : ''}grid gap-4 md:grid-cols-2`}>
                  <article className="rounded-[26px] bg-[#fff8d9] p-5 text-[#665220] max-md:rounded-[20px] max-md:p-4">
                    <h3 className="text-base font-black">どういう意味？</h3>
                    <p className="mt-3 text-sm font-bold leading-7 max-md:text-base">{jpExplanation}</p>
                  </article>
                  <article className="rounded-[26px] bg-[#eef8ff] p-5 text-[#354172] max-md:rounded-[20px] max-md:p-4">
                    <h3 className="text-base font-black">今日できるようになること</h3>
                    <p className="mt-3 text-sm font-bold leading-7 max-md:text-base">{lesson.learningGoal}</p>
                  </article>
                </div>

                <div className={`${hasPatternLesson || hasScrollLesson ? 'hidden ' : ''}rounded-[26px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(132,173,222,0.16)] max-md:rounded-[20px] max-md:p-4`}>
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

                {mode === 'learn' && !hasPatternLesson && !hasScrollLesson && (
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
