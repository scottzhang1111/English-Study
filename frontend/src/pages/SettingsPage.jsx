import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthMe, getChildren, getProgressData } from '../api';
import { useChildren } from '../ChildrenContext';
import { EQBottomNav } from '../components/eigo';

const DEFAULT_CHILD_AVATAR = '/assets/eigo-quest/child icon/child4.png';

function resolveAvatar(child) {
  const avatar = child?.avatar || '';
  return avatar.startsWith('/assets/') ? avatar : DEFAULT_CHILD_AVATAR;
}

function getChildName(child) {
  return child?.nickname || child?.name || '子ども';
}

function formatLearningGoal(child) {
  const value = child?.learning_goal || child?.learningGoal || child?.grade || child?.target_level || child?.targetLevel || '';
  if (value === 'eiken_pre2') return '英検準2級をめざす';
  if (value === 'eiken3') return '英検3級をめざす';
  if (value.includes('準') || value.includes('準2')) return '英検準2級をめざす';
  if (value.includes('3') || value.includes('３') || value.includes('三級')) return '英検3級をめざす';
  return value || '英検準2級をめざす';
}

function getDailyTarget(child) {
  return Number(child?.daily_word_target || child?.dailyWordTarget || child?.daily_target || child?.dailyTarget || 20) || 20;
}

function getTodaySummary(progress, child) {
  const target = getDailyTarget(child);
  const selectedDay = progress?.selected_day || null;
  const studied = Number(selectedDay?.studied_count || 0);
  const hasData = Boolean(selectedDay && studied > 0);
  return {
    target,
    studied,
    hasData,
    complete: hasData && studied >= target,
    percent: target ? Math.min(100, Math.round((studied / target) * 100)) : 0,
  };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { selectedChildId, setSelectedChildId, refreshChildren } = useChildren();
  const [childrenList, setChildrenList] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPageData() {
      setIsLoading(true);
      setError('');
      try {
        await getAuthMe();
      } catch (err) {
        navigate('/parent-login', { replace: true });
        return;
      }

      try {
        const payload = await getChildren();
        if (!active) return;
        const list = payload.children || [];
        setChildrenList(list);
        refreshChildren({ force: true }).catch(() => {});

        if (list.length === 0) {
          setSelectedChildId('');
          setProgressData(null);
          return;
        }

        const selectedExists = list.some((child) => String(child.id) === String(selectedChildId));
        const nextChild = selectedExists
          ? list.find((child) => String(child.id) === String(selectedChildId))
          : list[0];
        if (nextChild && String(nextChild.id) !== String(selectedChildId)) {
          setSelectedChildId(nextChild.id);
        }

        try {
          const progress = await getProgressData({ childId: nextChild.id });
          if (active) setProgressData(progress);
        } catch (err) {
          if (active) setProgressData(null);
        }
      } catch (err) {
        if (active) setError(err.message || '子どもの情報を読み込めませんでした。');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadPageData();
    return () => {
      active = false;
    };
  }, [navigate, refreshChildren, selectedChildId, setSelectedChildId]);

  const currentChild = useMemo(() => {
    if (!childrenList.length) return null;
    return childrenList.find((child) => String(child.id) === String(selectedChildId)) || childrenList[0];
  }, [childrenList, selectedChildId]);

  const today = getTodaySummary(progressData, currentChild);
  const previewChildren = childrenList.slice(0, 4);
  const statusText = today.complete ? '完了' : '未完了';

  const selectChild = async (child) => {
    setSelectedChildId(child.id);
    setIsSwitcherOpen(false);
    try {
      const progress = await getProgressData({ childId: child.id });
      setProgressData(progress);
    } catch (err) {
      setProgressData(null);
    }
  };

  return (
    <div className="eq-family-page">
      <main className="eq-family-shell">
        <header className="eq-family-hero">
          <div className="eq-family-hero-copy">
            <h1>ファミリールーム</h1>
            <p>子どもの学習を見守ろう</p>
          </div>
        </header>

        {isLoading ? (
          <section className="eq-family-panel eq-family-empty">
            <p>読み込み中...</p>
          </section>
        ) : error ? (
          <section className="eq-family-panel eq-family-empty">
            <p>{error}</p>
          </section>
        ) : currentChild ? (
          <>
            <section className="eq-family-current-card">
              <div className="eq-family-current-left">
                <img className="eq-family-current-avatar" src={resolveAvatar(currentChild)} alt="" />
                <span className="eq-family-current-label">現在の子ども</span>
              </div>

              <div className="eq-family-current-right">
                <h2>現在の子ども</h2>
                <div className="eq-family-current-info">
                  <h3>{getChildName(currentChild)}</h3>
                  <span className="eq-family-goal-badge">▣ {formatLearningGoal(currentChild)}</span>
                </div>

                <div className="eq-family-today">
                  <p>今日の学習状況</p>
                  <div className="eq-family-challenge-row">
                    <strong>{getDailyTarget(currentChild)}問チャレンジ</strong>
                    <em className={today.complete ? 'is-complete' : ''}>{statusText}</em>
                  </div>
                  <div className="eq-family-progress-row">
                    <span className="eq-family-progress-bar" style={{ '--family-progress': `${today.percent}%` }} />
                    <b>{today.hasData ? `${today.studied} / ${today.target}` : `0 / ${today.target}`}</b>
                  </div>
                </div>
              </div>
            </section>

            <button type="button" className="eq-family-action-card" onClick={() => setIsSwitcherOpen(true)}>
              <span className="eq-family-action-art is-switch" aria-hidden="true">
                {previewChildren.map((child, index) => (
                  <img key={child.id} src={resolveAvatar(child)} alt="" style={{ '--avatar-index': index }} />
                ))}
                <i>↻</i>
              </span>
              <span className="eq-family-action-copy">
                <strong>子どもを切り替える</strong>
                <small>学習する子どもを選びます</small>
              </span>
              <span className="eq-family-action-arrow" aria-hidden="true">›</span>
            </button>

            <button type="button" className="eq-family-action-card" onClick={() => navigate('/parent-dashboard')}>
              <span className="eq-family-action-art is-report" aria-hidden="true">
                <i>📖</i>
                <b>✦</b>
              </span>
              <span className="eq-family-action-copy">
                <strong>学習状況を見る</strong>
                <small>今日の進み具合と弱点を確認します</small>
              </span>
              <span className="eq-family-action-arrow" aria-hidden="true">›</span>
            </button>

            <section className="eq-family-panel eq-family-note-card">
              <span aria-hidden="true">▣</span>
              <p>
                お子さまの学習データは
                <br />
                保護者アカウントで管理されています
              </p>
            </section>
          </>
        ) : (
          <section className="eq-family-panel eq-family-empty">
            <p>子どものプロフィールを作成してください</p>
            <button type="button" onClick={() => navigate('/create-child-profile')}>
              子どもを追加
            </button>
          </section>
        )}
      </main>

      {isSwitcherOpen ? (
        <div className="eq-family-modal" role="dialog" aria-modal="true" aria-labelledby="child-switch-title" onClick={() => setIsSwitcherOpen(false)}>
          <section className="eq-family-sheet" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="child-switch-title">学習する子どもを選択</h2>
              <button type="button" onClick={() => setIsSwitcherOpen(false)} aria-label="閉じる">×</button>
            </header>
            <div className="eq-family-child-list">
              {childrenList.map((child) => {
                const active = String(child.id) === String(currentChild?.id);
                return (
                  <button key={child.id} type="button" className={active ? 'is-active' : ''} onClick={() => selectChild(child)}>
                    <img src={resolveAvatar(child)} alt="" />
                    <span>
                      <strong>{getChildName(child)}</strong>
                      <small>{formatLearningGoal(child)}</small>
                    </span>
                    {active ? <em>現在使用中</em> : null}
                  </button>
                );
              })}
            </div>
            <button type="button" className="eq-family-add-child" onClick={() => navigate('/create-child-profile')}>
              ＋ 子どもを追加
            </button>
          </section>
        </div>
      ) : null}

      <EQBottomNav className="eq-family-bottom-nav" />
    </div>
  );
}
