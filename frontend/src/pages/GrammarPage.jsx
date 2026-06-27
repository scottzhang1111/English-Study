import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQ_ASSETS,
  EQFantasyBadge,
  EQFantasyButton,
  EQHeroHeader,
  EQPageShell,
  EQProgressBar,
} from '../components/eigo';
import { getGrammarLessons, markGrammarLessonViewed } from '../api';
import { useChildren } from '../ChildrenContext';

const FILTERS = [
  { id: 'all', label: 'すべて' },
  { id: 'learning', label: '学習中' },
  { id: 'new', label: '未学習' },
  { id: 'done', label: '完了', icon: '★' },
];

function targetLevelLabel(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw) return '英検';
  if (normalized === 'eiken_pre2' || normalized.includes('pre2') || raw.includes('準2') || raw.includes('準２')) {
    return '英検準2級';
  }
  if (normalized === 'eiken3' || raw.includes('3級') || raw.includes('３級')) {
    return '英検3級';
  }
  if (normalized === 'eiken2' || raw.includes('2級') || raw.includes('２級')) {
    return '英検2級';
  }
  if (normalized === 'eiken4' || raw.includes('4級') || raw.includes('４級')) {
    return '英検4級';
  }
  if (normalized === 'eiken5' || raw.includes('5級') || raw.includes('５級')) {
    return '英検5級';
  }
  return raw;
}

function statusMeta(status = '未学習') {
  if (status === '合格') return { label: '合格', key: 'passed', icon: '♛', tone: 'green' };
  if (status === 'テスト未合格') return { label: 'テスト未合格', key: 'failed', icon: '×', tone: 'red' };
  if (status === '学習中') return { label: '学習中', key: 'learning', icon: '●', tone: 'cyan' };
  return { label: '未学習', key: 'new', icon: '●', tone: 'blue' };
}

function isHighFrequency(lesson) {
  const category = String(lesson.category || '');
  return category.includes('高頻') || category.toLowerCase().includes('pattern');
}

function lessonDescription(lesson) {
  return lesson.grammarPoint || lesson.grammar_point || lesson.learningGoal || lesson.learning_goal || lesson.jpExplanation || '';
}

function lessonProgress(lesson) {
  const progress = lesson.progress || {};
  const total = Number(progress.totalQuizCount || progress.totalQuestions || lesson.quizCount || lesson.question_count || 0);
  const correct = Number(progress.correctQuizCount || progress.correct_count || 0);
  if (!total || !correct) return null;
  return { value: correct, max: total };
}

function crestIcon(lesson) {
  const title = `${lesson.title || ''} ${lesson.category || ''}`.toLowerCase();
  if (title.includes('比較')) return '⚖';
  if (title.includes('現在')) return '⌛';
  if (title.includes('未来')) return '⌕';
  if (title.includes('doing')) return '✦';
  if (title.includes('do')) return '✧';
  return '✦';
}

function actionLabel(meta) {
  if (meta.key === 'learning' || meta.key === 'failed') return '続きから学習';
  return '学習する';
}

function matchesFilter(lesson, filterId) {
  const meta = statusMeta(lesson.status);
  if (filterId === 'all') return true;
  if (filterId === 'done') return meta.key === 'passed';
  if (filterId === 'new') return meta.key === 'new';
  if (filterId === 'learning') return meta.key === 'learning' || meta.key === 'failed';
  return true;
}

function GrammarTowerCard({ lesson, busy, onLearn }) {
  const meta = statusMeta(lesson.status);
  const description = lessonDescription(lesson);
  const category = lesson.category || (isHighFrequency(lesson) ? '高頻句型' : '文法項目');
  const progress = lessonProgress(lesson);

  return (
    <article className={`eq-grammar-rpg-list-card is-${meta.key}`}>
      <div className="eq-grammar-rpg-crest" aria-hidden="true">
        <span>{crestIcon(lesson)}</span>
      </div>
      <div className="eq-grammar-rpg-list-main">
        <div className="eq-grammar-rpg-card-head">
          <span className="eq-grammar-rpg-category">{category}</span>
          <span className={`eq-grammar-rpg-status is-${meta.key}`}>
            <i aria-hidden="true">{meta.icon}</i>
            {meta.label}
          </span>
        </div>
        <h2>{lesson.title}</h2>
        <p>{description}</p>
        {progress ? (
          <EQProgressBar
            className="eq-grammar-rpg-tiny-progress"
            value={progress.value}
            max={progress.max}
            showText={false}
          />
        ) : null}
      </div>
      <div className="eq-grammar-rpg-card-actions">
        <EQFantasyButton className="eq-grammar-rpg-card-button" onClick={onLearn} disabled={busy}>
          {busy ? '準備中...' : actionLabel(meta)}
        </EQFantasyButton>
      </div>
    </article>
  );
}

export default function GrammarPage() {
  const navigate = useNavigate();
  const { children, selectedChildId } = useChildren();
  const childId = useMemo(() => selectedChildId || '', [selectedChildId]);
  const currentChild = useMemo(
    () => (children || []).find((child) => String(child.id) === String(childId)) || null,
    [childId, children],
  );
  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total: 0, mastered: 0 });
  const [preparingMessage, setPreparingMessage] = useState('');
  const [apiTargetLevel, setApiTargetLevel] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [busyLessonId, setBusyLessonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }

    setLoading(true);
    getGrammarLessons(childId)
      .then((payload) => {
        setLessons(payload.lessons || []);
        setStats(payload.stats || {});
        setApiTargetLevel(payload.targetLevel || payload.target_level || '');
        setPreparingMessage(payload.preparing ? (payload.message || '3級文法は準備中です') : '');
      })
      .catch((err) => setError(err.message || '文法レッスンを読み込めませんでした。'))
      .finally(() => setLoading(false));
  }, [childId, navigate]);

  const filteredLessons = useMemo(
    () => lessons.filter((lesson) => matchesFilter(lesson, activeFilter)),
    [activeFilter, lessons],
  );

  const progressTotal = stats.total || lessons.length || 0;
  const progressMastered = stats.mastered || 0;
  const childTargetLevelLabel = targetLevelLabel(
    apiTargetLevel
      || currentChild?.targetLevel
      || currentChild?.target_level
      || currentChild?.learningGoal
      || currentChild?.learning_goal,
  );

  const startLesson = (lesson) => {
    const lessonPath = `/grammar-quest?lessonId=${encodeURIComponent(lesson.lessonId)}`;
    setBusyLessonId(lesson.lessonId);
    setError('');
    markGrammarLessonViewed({ childId, lessonId: lesson.lessonId })
      .catch(() => null)
      .finally(() => {
        navigate(lessonPath);
        setBusyLessonId('');
      });
  };

  return (
    <EQPageShell withBottomNav bottomNavClassName="eq-learning-hub-bottom-nav" contentClassName="eq-grammar-rpg-page" maxWidth="430px">
      <EQHeroHeader
        className="eq-grammar-rpg-hero"
        title="文法の塔"
        subtitle={`${childTargetLevelLabel}の重要文法を\n一つずつ攻略しよう！`}
        bgImage={EQ_ASSETS.bg.grammarTemple}
        helperImage={EQ_ASSETS.spirit.happy}
      >
        <div className="eq-grammar-rpg-hero-badges">
          <EQFantasyBadge>{childTargetLevelLabel}</EQFantasyBadge>
          <EQFantasyBadge icon="⚒">文法</EQFantasyBadge>
          <EQFantasyBadge>{progressTotal || 0} lessons</EQFantasyBadge>
        </div>
      </EQHeroHeader>

      <nav className="eq-grammar-rpg-tabs" aria-label="文法フィルター">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeFilter === filter.id ? 'is-active' : ''}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.icon ? <span aria-hidden="true">{filter.icon}</span> : null}
            <strong>{filter.label}</strong>
          </button>
        ))}
      </nav>

      {error ? <div className="eq-grammar-rpg-message is-error">{error}</div> : null}

      {loading ? (
        <div className="eq-grammar-rpg-message">文法レッスンを読み込んでいます...</div>
      ) : preparingMessage ? (
        <div className="eq-grammar-rpg-message">{preparingMessage}</div>
      ) : (
        <section className="eq-grammar-rpg-list" aria-label="文法レッスン一覧">
          {filteredLessons.map((lesson) => (
            <GrammarTowerCard
              key={lesson.lessonId}
              lesson={lesson}
              busy={busyLessonId === lesson.lessonId}
              onLearn={() => startLesson(lesson)}
            />
          ))}
          {!filteredLessons.length ? (
            <div className="eq-grammar-rpg-message">
              このカテゴリの文法はまだありません。
            </div>
          ) : null}
        </section>
      )}

      <div className="eq-grammar-rpg-footer-count">
        攻略数 {progressMastered} / {progressTotal}
      </div>
    </EQPageShell>
  );
}
