import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EQ_ASSETS, EQFantasyButton, EQPageShell } from '../components/eigo';
import { getGrammarLessons, markGrammarLessonViewed } from '../api';
import { useChildren } from '../ChildrenContext';

const FILTERS = [
  { id: 'all', label: 'すべて' },
  { id: 'high', label: '高頻句型' },
  { id: 'grammar', label: '文法項目' },
];

function statusMeta(status = '未学習') {
  if (status === '合格') return { label: '合格', key: 'passed', icon: '♛' };
  if (status === 'テスト未合格') return { label: 'テスト未合格', key: 'failed', icon: '×' };
  if (status === '学習中') return { label: '学習中', key: 'learning', icon: '●' };
  return { label: '未学習', key: 'new', icon: '●' };
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
  return score ? `${score}/${total || 10}` : `-/ ${total || 10}`.replace(' ', '');
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

function GrammarTowerCard({ lesson, busy, onLearn }) {
  const meta = statusMeta(lesson.status);
  const description = lessonDescription(lesson);
  const category = lesson.category || (isHighFrequency(lesson) ? '高頻句型' : '文法項目');
  const lastTestedAt = lesson.last_tested_at || lesson.progress?.lastTestedAt;

  return (
    <article className="eq-grammar-rpg-list-card">
      <div className="eq-grammar-rpg-lesson-no">{lesson.displayOrder || lesson.display_order || '-'}</div>
      <div className="eq-grammar-rpg-list-main">
        <div className="eq-grammar-rpg-card-head">
          <h2>{lesson.title}</h2>
          <span className="eq-grammar-rpg-category">{category}</span>
        </div>
        <p>{description}</p>
        <div className="eq-grammar-rpg-list-meta">
          <span className={`eq-grammar-rpg-status is-${meta.key}`}>
            <i aria-hidden="true">{meta.icon}</i>
            {meta.label}
          </span>
          <strong>{lessonScore(lesson)}</strong>
          {lastTestedAt ? <time>{formatDate(lastTestedAt)}</time> : null}
        </div>
      </div>
      <EQFantasyButton className="eq-grammar-rpg-card-button" onClick={onLearn} disabled={busy}>
        {busy ? '準備中...' : '学習する'}
      </EQFantasyButton>
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

  const filteredLessons = useMemo(() => {
    if (activeFilter === 'high') return lessons.filter(isHighFrequency);
    if (activeFilter === 'grammar') return lessons.filter((lesson) => !isHighFrequency(lesson));
    return lessons;
  }, [activeFilter, lessons]);

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
      <header className="eq-grammar-rpg-header">
        <button type="button" className="eq-grammar-rpg-back" onClick={() => navigate(-1)} aria-label="戻る">
          ←
        </button>
        <div>
          <h1>文法の塔</h1>
          <p>英検準2級の重要文法を一つずつ攻略しよう！</p>
        </div>
        <img src={EQ_ASSETS.spirit.happy} alt="" />
      </header>

      <nav className="eq-grammar-rpg-tabs" aria-label="文法フィルター">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeFilter === filter.id ? 'is-active' : ''}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
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
        攻略数 {stats.mastered || 0} / {stats.total || lessons.length || 0}
      </div>
    </EQPageShell>
  );
}
