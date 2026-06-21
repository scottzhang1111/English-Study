import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WebLearningLayout from '../components/WebLearningLayout';
import { EQBottomNav, MagicPanel } from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import { getGrammarLessons, markGrammarLessonViewed } from '../api';
import { useChildren } from '../ChildrenContext';

const STATUS_STYLES = {
  未学習: 'border-white/20 bg-white/10 text-white/78',
  学習中: 'border-cyan-300/55 bg-cyan-300/14 text-cyan-100',
  テスト未合格: 'border-amber-300/55 bg-amber-300/14 text-amber-100',
  合格: 'border-emerald-300/55 bg-emerald-300/14 text-emerald-100',
};

function levelLabel(level) {
  if (level === 'eiken_pre2' || String(level).includes('準')) return '英検準2級';
  if (level === 'eiken3' || String(level).includes('3')) return '英検3級';
  return level || '英検準2級';
}

function formatDate(value) {
  if (!value) return 'まだありません';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function LessonCard({ lesson, busy, expanded, onLearn, onTest, onResults }) {
  const status = lesson.status || '未学習';
  const questionCount = Number(lesson.question_count ?? lesson.quizCount ?? 0);
  const patternCount = Number(lesson.pattern_count ?? lesson.patternCount ?? 0);
  const lastScore = lesson.last_score;
  const bestScore = lesson.best_score;
  const progress = lesson.progress || {};
  const lastStudiedAt = lesson.last_tested_at || progress.lastStudiedAt || lesson.viewed_at;

  return (
    <article className="rounded-[26px] border border-[#e7c76a]/55 bg-[linear-gradient(145deg,rgba(20,36,82,0.96),rgba(45,25,77,0.94))] p-4 text-white shadow-[0_18px_42px_rgba(3,8,32,0.32)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 text-[11px] font-black">
            <span className="rounded-full border border-[#ffd86f]/45 bg-[#ffd86f]/12 px-3 py-1 text-[#ffe69a]">
              {levelLabel(lesson.level)}
            </span>
            <span className="rounded-full border border-violet-300/35 bg-violet-300/10 px-3 py-1 text-violet-100">
              {lesson.category || '文法'}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight">{lesson.title}</h2>
          <p className="mt-1 text-sm font-bold leading-6 text-white/68">
            {lesson.grammarPoint || lesson.learningGoal || '重要文法を攻略しよう'}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${STATUS_STYLES[status] || STATUS_STYLES.未学習}`}>
          {status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black sm:grid-cols-4">
        <div className="rounded-[16px] bg-white/8 px-3 py-3">
          <span className="block text-white/48">PATTERNS</span>
          <strong className="mt-1 block text-base text-[#ffe69a]">{patternCount}</strong>
        </div>
        <div className="rounded-[16px] bg-white/8 px-3 py-3">
          <span className="block text-white/48">QUESTIONS</span>
          <strong className="mt-1 block text-base text-cyan-100">{questionCount}</strong>
        </div>
        <div className="rounded-[16px] bg-white/8 px-3 py-3">
          <span className="block text-white/48">LAST</span>
          <strong className="mt-1 block text-base">{lastScore == null ? '--' : `${lastScore}/${progress.totalQuestions || questionCount}`}</strong>
        </div>
        <div className="rounded-[16px] bg-white/8 px-3 py-3">
          <span className="block text-white/48">BEST</span>
          <strong className="mt-1 block text-base text-emerald-200">{bestScore == null ? '--' : `${bestScore}/${progress.totalQuestions || questionCount}`}</strong>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold text-white/55">最後の学習: {formatDate(lastStudiedAt)}</p>

      {expanded ? (
        <div className="mt-3 rounded-[18px] border border-white/14 bg-black/15 px-4 py-3 text-sm font-bold text-white/78">
          <p>テスト回数: {progress.attemptsCount || 0}回</p>
          <p className="mt-1">合格ライン: 80%</p>
          <p className="mt-1">最終テスト: {formatDate(lesson.last_tested_at)}</p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={busy}
          onClick={onLearn}
          className="min-h-12 rounded-[16px] bg-[linear-gradient(180deg,#ffe783,#efb932)] px-4 py-3 text-sm font-black text-[#35260a] shadow-[0_8px_20px_rgba(239,185,50,0.2)] disabled:opacity-55"
        >
          {busy ? '記録中...' : status === '未学習' ? '学習する' : '復習する'}
        </button>
        <button type="button" onClick={onTest} className="min-h-12 rounded-[16px] border border-cyan-300/45 bg-cyan-300/12 px-4 py-3 text-sm font-black text-cyan-50">
          テストする
        </button>
        <button type="button" onClick={onResults} className="min-h-12 rounded-[16px] border border-white/22 bg-white/8 px-4 py-3 text-sm font-black text-white/84">
          結果を見る
        </button>
      </div>
    </article>
  );
}

export default function GrammarPage() {
  const navigate = useNavigate();
  const { selectedChildId } = useChildren();
  const childId = useMemo(() => selectedChildId || '', [selectedChildId]);
  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total: 0, mastered: 0 });
  const [preparingMessage, setPreparingMessage] = useState('');
  const [expandedLessonId, setExpandedLessonId] = useState('');
  const [busyLessonId, setBusyLessonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLessons = () => getGrammarLessons(childId).then((payload) => {
    setLessons(payload.lessons || []);
    setStats(payload.stats || {});
    setPreparingMessage(payload.preparing ? (payload.message || '3級文法は準備中です') : '');
  });

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }
    setLoading(true);
    loadLessons()
      .catch((err) => setError(err.message || '文法レッスンを読み込めませんでした。'))
      .finally(() => setLoading(false));
  }, [childId, navigate]);

  const startLesson = (lesson) => {
    setBusyLessonId(lesson.lessonId);
    setError('');
    markGrammarLessonViewed({ childId, lessonId: lesson.lessonId })
      .then(() => navigate(`/grammar-quest?lessonId=${encodeURIComponent(lesson.lessonId)}`))
      .catch((err) => setError(err.message || '学習を記録できませんでした。'))
      .finally(() => setBusyLessonId(''));
  };

  return (
    <>
      <WebLearningLayout title="文法の塔" subtitle="英検準2級の重要文法を一つずつ攻略しよう" mobileTight hideMobileHeader>
        <div className="mx-auto w-full max-w-4xl pb-24">
          <CompactPageHeader
            title="文法の塔"
            subtitle="英検準2級の重要文法を一つずつ攻略しよう"
            backgroundImage="/assets/eigo-quest/learning-hub/文法練習.png"
            elementLabel="文"
            progressText={`${stats.mastered || 0} / ${stats.total || 0}`}
            helperImage="/assets/eigo-quest/spirit_assets/happy.png"
            variant="grammar"
          />

          {error ? <div className="mt-4 rounded-[18px] border border-rose-300/35 bg-rose-950/45 p-4 text-sm font-bold text-rose-100">{error}</div> : null}

          {loading ? (
            <MagicPanel className="mt-4 p-5 text-center"><p>文法レッスンを準備しています...</p></MagicPanel>
          ) : preparingMessage ? (
            <MagicPanel className="mt-4 p-5">
              <span className="text-xs font-black text-[#ffd86f]">準2級で利用できます</span>
              <h2 className="mt-2 text-xl font-black">{preparingMessage}</h2>
              <p className="mt-2 text-sm font-bold text-white/70">このコースは英検準2級を選んだ子ども向けです。</p>
            </MagicPanel>
          ) : (
            <section className="mt-4 grid gap-4" aria-label="文法课程一览">
              {lessons.map((lesson) => (
                <LessonCard
                  key={lesson.lessonId}
                  lesson={lesson}
                  busy={busyLessonId === lesson.lessonId}
                  expanded={expandedLessonId === lesson.lessonId}
                  onLearn={() => startLesson(lesson)}
                  onTest={() => navigate(`/grammar-practice?lessonId=${encodeURIComponent(lesson.lessonId)}`)}
                  onResults={() => setExpandedLessonId((current) => current === lesson.lessonId ? '' : lesson.lessonId)}
                />
              ))}
              {!lessons.length ? <MagicPanel className="p-5"><p>利用できる文法レッスンはまだありません。</p></MagicPanel> : null}
            </section>
          )}
        </div>
      </WebLearningLayout>
      <EQBottomNav />
    </>
  );
}
