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

function lessonScore(lesson) {
  const progress = lesson.progress || {};
  const total = Number(progress.totalQuizCount || progress.totalQuestions || lesson.quizCount || lesson.question_count || 10);
  const score = Number(progress.bestScore || lesson.best_score || lesson.last_score || 0);
  return score ? `${score}/${total || 10}` : `-/${total || 10}`;
}

function lessonProgress(lesson) {
  const progress = lesson.progress || {};
  const total = Number(progress.totalQuizCount || progress.totalQuestions || lesson.quizCount || lesson.question_count || 0);
  const correct = Number(progress.correctQuizCount || progress.correct_count || 0);
  if (!total || !correct) return null;
  return { value: correct, max: total };
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
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
  if (meta.key === 'passed') return '復習する';
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
  const lastTestedAt = lesson.last_tested_at || lesson.progress?.lastTestedAt;
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
        <div className="eq-grammar-rpg-list-meta">
          <strong>{lessonScore(lesson)}</strong>
          {lastTestedAt ? <time>{formatDate(lastTestedAt)}</time> : null}
        </div>
      </div>
      <div className="eq-grammar-rpg-card-actions">
        {progress ? (
          <EQProgressBar
            value={progress.value}
            max={progress.max}
            label={`${Math.round((progress.value / progress.max) * 100)}%`}
          />
        ) : null}
        <EQFantasyButton className="eq-grammar-rpg-card-button" onClick={onLearn} disabled={busy}>
          {busy ? '準備中...' : actionLabel(meta)}
        </EQFantasyButton>
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
        subtitle={'英検準2級の重要文法を\n一つずつ攻略しよう！'}
        bgImage={EQ_ASSETS.bg.grammarTemple}
        helperImage={EQ_ASSETS.spirit.happy}
      >
        <div className="eq-grammar-rpg-hero-badges">
          <EQFantasyBadge icon="⚒">文法</EQFantasyBadge>
          <EQFantasyBadge>{progressMastered} / {progressTotal}</EQFantasyBadge>
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
