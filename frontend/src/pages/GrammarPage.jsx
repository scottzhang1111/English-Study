import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQ_ASSETS,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQPageShell,
} from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import BgmToggle from '../components/eigo/BgmToggle';
import { getGrammarLessons, markGrammarLessonViewed } from '../api';
import { useChildren } from '../ChildrenContext';

const FILTERS = [
  { id: 'learning', label: '学習中', icon: '✦' },
  { id: 'new', label: '未学習', icon: '✦' },
  { id: 'done', label: '完了', icon: '★' },
];

function levelLabel(level) {
  if (level === 'eiken_pre2' || String(level).includes('準')) return '英検準2級';
  if (level === 'eiken3' || String(level).includes('3')) return '英検3級';
  return level || '英検準2級';
}

function lessonState(lesson) {
  const status = lesson.status || '未学習';
  if (status === '未学習') {
    return {
      key: 'new',
      label: '未学習',
      buttonLabel: '学習する',
      badgeVariant: 'blue',
      cardStateClass: 'is-new',
    };
  }
  if (status === '合格') {
    return {
      key: 'done',
      label: '完了',
      buttonLabel: '復習する',
      badgeVariant: 'gold',
      cardStateClass: 'is-done',
    };
  }
  return {
    key: 'learning',
    label: '学習中',
    buttonLabel: '続きから学習',
    badgeVariant: 'green',
    cardStateClass: 'is-learning',
  };
}

function lessonProgressPercent(lesson) {
  const progress = lesson.progress || {};
  const total = Number(progress.totalQuizCount || progress.totalQuestions || lesson.quizCount || lesson.question_count || 0);
  const solved = Number(progress.correctQuizCount || progress.bestScore || lesson.best_score || 0);
  if (total > 0 && solved > 0) {
    return Math.min(100, Math.max(8, Math.round((solved / total) * 100)));
  }
  return progress.viewCount || lesson.viewed_at ? 40 : 0;
}

function LessonCard({ lesson, busy, onLearn }) {
  const state = lessonState(lesson);
  const progressPercent = lessonProgressPercent(lesson);
  const category = lesson.category || levelLabel(lesson.level);
  const description = lesson.grammarPoint || lesson.learningGoal || lesson.jpExplanation || '重要文法を攻略しよう';

  return (
    <EQFantasyCard hideHeader className={`eq-grammar-tower-card ${state.cardStateClass}`}>
      <div className="eq-grammar-tower-card__layout">
        <div className="eq-grammar-tower-card__crest" aria-hidden="true">
          <span>{state.key === 'done' ? '★' : '✦'}</span>
        </div>

        <div className="eq-grammar-tower-card__main">
          <div className="eq-grammar-tower-card__topline">
            <EQFantasyBadge variant={state.badgeVariant}>{category}</EQFantasyBadge>
            <EQFantasyBadge variant={state.badgeVariant}>{state.label}</EQFantasyBadge>
          </div>
          <h2>{lesson.title}</h2>
          <p>{description}</p>
        </div>

        <div className="eq-grammar-tower-card__action">
          {state.key === 'learning' ? (
            <div className="eq-grammar-tower-card__progress" aria-label={`進捗 ${progressPercent}%`}>
              <span style={{ width: `${progressPercent}%` }} />
              <strong>{progressPercent}%</strong>
            </div>
          ) : null}
          <EQFantasyButton fullWidth onClick={onLearn} disabled={busy}>
            {busy ? '記録中...' : state.buttonLabel}
          </EQFantasyButton>
        </div>
      </div>
    </EQFantasyCard>
  );
}

export default function GrammarPage() {
  const navigate = useNavigate();
  const { selectedChildId } = useChildren();
  const childId = useMemo(() => selectedChildId || '', [selectedChildId]);
  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total: 0, mastered: 0 });
  const [preparingMessage, setPreparingMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState('learning');
  const [busyLessonId, setBusyLessonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLessons = () => getGrammarLessons(childId).then((payload) => {
    setLessons(payload.lessons || []);
    setStats(payload.stats || {});
    setPreparingMessage(payload.preparing ? (payload.message || '3級文法の準備中です') : '');
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

  const filteredLessons = useMemo(
    () => lessons.filter((lesson) => lessonState(lesson).key === activeFilter),
    [activeFilter, lessons],
  );

  const filterCounts = useMemo(
    () => lessons.reduce((counts, lesson) => {
      const key = lessonState(lesson).key;
      return { ...counts, [key]: (counts[key] || 0) + 1 };
    }, { learning: 0, new: 0, done: 0 }),
    [lessons],
  );

  const startLesson = (lesson) => {
    setBusyLessonId(lesson.lessonId);
    setError('');
    markGrammarLessonViewed({ childId, lessonId: lesson.lessonId })
      .then(() => navigate(`/grammar-quest?lessonId=${encodeURIComponent(lesson.lessonId)}`))
      .catch((err) => setError(err.message || '学習を記録できませんでした。'))
      .finally(() => setBusyLessonId(''));
  };

  return (
    <EQPageShell withBottomNav bottomNavClassName="eq-learning-hub-bottom-nav" contentClassName="eq-grammar-tower-page" maxWidth="980px">
      <CompactPageHeader
        title="文法の塔"
        subtitle="英検準2級の重要文法を一つずつ攻略しよう"
        backgroundImage="/assets/eigo-quest/learning-hub/文法練習.png"
        elementLabel="文法"
        progressText={`${stats.mastered || 0} / ${stats.total || 0}`}
        helperImage={EQ_ASSETS.spirit.happy}
        variant="grammar"
        action={<BgmToggle />}
      />

      <div className="eq-grammar-tower-tabs" role="tablist" aria-label="文法レッスンの状態">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.id}
            className={activeFilter === filter.id ? 'is-active' : ''}
            onClick={() => setActiveFilter(filter.id)}
          >
            <span aria-hidden="true">{filter.icon}</span>
            <strong>{filter.label}</strong>
            <small>{filterCounts[filter.id] || 0}</small>
          </button>
        ))}
      </div>

      {error ? <div className="eq-grammar-tower-message is-error">{error}</div> : null}

      {loading ? (
        <EQFantasyCard hideHeader className="eq-grammar-tower-message-card">
          <p>文法レッスンを準備しています...</p>
        </EQFantasyCard>
      ) : preparingMessage ? (
        <EQFantasyCard hideHeader className="eq-grammar-tower-message-card">
          <EQFantasyBadge>準2級で利用できます</EQFantasyBadge>
          <h2>{preparingMessage}</h2>
          <p>このコースは英検準2級を選んだ子ども向けです。</p>
        </EQFantasyCard>
      ) : (
        <section className="eq-grammar-tower-list" aria-label="文法課程一覧">
          {filteredLessons.map((lesson) => (
            <LessonCard
              key={lesson.lessonId}
              lesson={lesson}
              busy={busyLessonId === lesson.lessonId}
              onLearn={() => startLesson(lesson)}
            />
          ))}
          {!filteredLessons.length ? (
            <EQFantasyCard hideHeader className="eq-grammar-tower-message-card">
              <p>{FILTERS.find((filter) => filter.id === activeFilter)?.label}の文法はありません。</p>
            </EQFantasyCard>
          ) : null}
        </section>
      )}
    </EQPageShell>
  );
}
