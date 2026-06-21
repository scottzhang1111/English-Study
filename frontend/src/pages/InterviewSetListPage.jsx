import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEikenInterviewSets } from '../api';
import { useChildren } from '../ChildrenContext';
import {
  EQBottomNav,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQHeroHeader,
  EQPageShell,
} from '../components/eigo';

function isPre2Level(child) {
  const level = String(child?.targetLevel || child?.target_level || child?.learningGoal || child?.learning_goal || '').toLowerCase();
  return level === 'eiken_pre2' || level.includes('準2') || level.includes('準２');
}

export default function InterviewSetListPage() {
  const { children, childrenLoading, selectedChildId } = useChildren();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentChild = useMemo(
    () => children.find((child) => String(child.id) === String(selectedChildId)) || children[0],
    [children, selectedChildId],
  );
  const canPractice = isPre2Level(currentChild);

  useEffect(() => {
    if (childrenLoading) return undefined;
    if (!canPractice) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    getEikenInterviewSets()
      .then((payload) => {
        if (active) setSets(payload.sets || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.status === 401
          ? 'ログインの有効期限が切れました。もう一度ログインしてください。'
          : (err.message || '面接セットを読み込めませんでした。'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [canPractice, childrenLoading]);

  if (childrenLoading) {
    return <div className="eq-interview-loading">読み込み中...</div>;
  }

  if (!canPractice) {
    return (
      <EQPageShell className="eq-interview-page" withBottomNav>
        <EQHeroHeader eyebrow="INTERVIEW PRACTICE" title="英検準2級 面接練習" subtitle="この練習は英検準2級で利用できます。" />
        <EQFantasyCard title="準2級で利用できます" subtitle="子どもの目標級を確認してください。">
          <EQFantasyButton as={Link} to="/learning-hub" fullWidth>学習メニューへ</EQFantasyButton>
        </EQFantasyCard>
      </EQPageShell>
    );
  }

  return (
    <EQPageShell className="eq-interview-page" contentClassName="eq-interview-page-content" maxWidth="820px">
      <EQHeroHeader
        eyebrow="INTERVIEW PRACTICE"
        title="英検準2級 AI面接練習"
        subtitle="10の面接セットから選んで、本番と同じ5問に挑戦しよう。"
        badges={[`${sets.length} SETS`, '約8分']}
      >
        <EQFantasyButton as={Link} to="/interview-guide" variant="blue" className="eq-interview-guide-link">
          面接の秘伝書
        </EQFantasyButton>
      </EQHeroHeader>

      {loading ? <p className="eq-interview-status">面接セットを読み込み中...</p> : null}
      {error ? <p className="eq-interview-status is-error">{error}</p> : null}
      {!loading && !error && sets.length === 0 ? (
        <p className="eq-interview-status">準備中</p>
      ) : null}

      <section className="eq-interview-set-grid" aria-label="面接セット一覧">
        {sets.map((set, index) => (
          <EQFantasyCard
            key={set.id}
            eyebrow={`SET ${String(index + 1).padStart(2, '0')}`}
            title={set.title}
            subtitle={set.passage_title}
            className="eq-interview-set-card"
            actions={<EQFantasyBadge variant="blue">準2級</EQFantasyBadge>}
            footer={(
              <EQFantasyButton as={Link} to={`/interview/${set.id}`} fullWidth>
                チャレンジ
              </EQFantasyButton>
            )}
          >
            <div className="eq-interview-set-meta">
              <EQFantasyBadge>5問</EQFantasyBadge>
              <EQFantasyBadge variant="blue">約8分</EQFantasyBadge>
            </div>
          </EQFantasyCard>
        ))}
      </section>
      <EQBottomNav />
    </EQPageShell>
  );
}
