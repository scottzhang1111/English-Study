import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAuthMe,
  getChildren,
  getEikenRealExamWrongQuestions,
  getGrammarQuizWrongQuestions,
  getProgressData,
  getVocabWrongReviews,
} from '../api';
import { useChildren } from '../ChildrenContext';
import { EQBottomNav } from '../components/eigo';

const DEFAULT_CHILD_AVATAR = '/assets/eigo-quest/child icon/child4.png';

function getChildName(child) {
  return child?.nickname || child?.name || '子ども';
}

function formatLearningGoal(child) {
  const value = child?.target_level || child?.targetLevel || child?.learning_goal || child?.learningGoal || child?.grade || '';
  if (value === 'eiken_pre2') return '英検準2級をめざす';
  if (value === 'eiken3') return '英検3級をめざす';
  if (value.includes('準2') || value.includes('準２')) return '英検準2級をめざす';
  if (value.includes('3') || value.includes('３') || value.includes('三級')) return '英検3級をめざす';
  return value || '英検準2級をめざす';
}

function getDailyTarget(child) {
  return Number(child?.daily_word_target || child?.dailyWordTarget || child?.daily_target || child?.dailyTarget || 20) || 20;
}

function countReviewItems(payload, keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key].length;
  }
  return 0;
}

export default function ParentDashboardPage() {
  const navigate = useNavigate();
  const { selectedChildId, setSelectedChildId } = useChildren();
  const [childrenList, setChildrenList] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const [reviewCount, setReviewCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError('');
      try {
        await getAuthMe();
      } catch (err) {
        navigate('/parent-login', { replace: true });
        return;
      }

      try {
        const childrenPayload = await getChildren();
        if (!active) return;
        const list = childrenPayload.children || [];
        setChildrenList(list);
        if (list.length === 0) {
          setSelectedChildId('');
          setProgressData(null);
          setReviewCount(null);
          return;
        }

        const selectedExists = list.some((child) => String(child.id) === String(selectedChildId));
        const child = selectedExists ? list.find((item) => String(item.id) === String(selectedChildId)) : list[0];
        if (child && String(child.id) !== String(selectedChildId)) {
          setSelectedChildId(child.id);
        }

        const [progressResult, vocabResult, grammarResult, eikenResult] = await Promise.allSettled([
          getProgressData({ childId: child.id }),
          getVocabWrongReviews(child.id),
          getGrammarQuizWrongQuestions(child.id),
          getEikenRealExamWrongQuestions(child.id),
        ]);

        if (!active) return;
        setProgressData(progressResult.status === 'fulfilled' ? progressResult.value : null);
        const count = [
          vocabResult.status === 'fulfilled' ? countReviewItems(vocabResult.value, ['wrongReviews', 'wrong_reviews']) : 0,
          grammarResult.status === 'fulfilled' ? countReviewItems(grammarResult.value, ['wrongQuestions', 'wrong_questions']) : 0,
          eikenResult.status === 'fulfilled' ? countReviewItems(eikenResult.value, ['wrongQuestions', 'wrong_questions']) : 0,
        ].reduce((sum, value) => sum + value, 0);
        setReviewCount(count);
      } catch (err) {
        if (active) setError(err.message || '学習状況を読み込めませんでした。');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [navigate, selectedChildId, setSelectedChildId]);

  const currentChild = useMemo(() => {
    if (!childrenList.length) return null;
    return childrenList.find((child) => String(child.id) === String(selectedChildId)) || childrenList[0];
  }, [childrenList, selectedChildId]);

  const target = getDailyTarget(currentChild);
  const selectedDay = progressData?.selected_day || null;
  const studied = Number(selectedDay?.studied_count || 0);
  const hasTodayData = Boolean(selectedDay && studied > 0);
  const complete = hasTodayData && studied >= target;
  const progressText = hasTodayData ? `${studied} / ${target}` : 'まだ学習データがありません';
  const stageText = progressData?.world || progressData?.stage
    ? `${progressData.world || ''} ${progressData.stage || ''}`.trim()
    : '学習データを準備中です';

  return (
    <div className="eq-family-page">
      <main className="eq-family-shell">
        <header className="eq-family-hero">
          <span aria-hidden="true">✦</span>
          <div>
            <h1>学習状況</h1>
            <p>子どもの学習を確認しましょう</p>
          </div>
          <span aria-hidden="true">✦</span>
        </header>

        {isLoading ? (
          <section className="eq-family-panel eq-family-empty"><p>読み込み中...</p></section>
        ) : error ? (
          <section className="eq-family-panel eq-family-empty"><p>{error}</p></section>
        ) : currentChild ? (
          <>
            <section className="eq-family-dashboard-child">
              <img src={(currentChild.avatar || '').startsWith('/assets/') ? currentChild.avatar : DEFAULT_CHILD_AVATAR} alt="" />
              <div>
                <strong>{getChildName(currentChild)}</strong>
                <span>{formatLearningGoal(currentChild)}</span>
              </div>
            </section>

            <section className="eq-family-dashboard-grid">
              <article className="eq-family-dashboard-card">
                <span>今日の学習</span>
                <strong>今日の冒険：{target}問</strong>
                <p>状態：{hasTodayData ? (complete ? '完了' : '未完了') : '未完了'}</p>
                <small>{progressText}</small>
              </article>

              <article className="eq-family-dashboard-card">
                <span>学習目標</span>
                <strong>{formatLearningGoal(currentChild)}</strong>
                <p>毎日少しずつ進めます</p>
              </article>

              <article className="eq-family-dashboard-card">
                <span>進み具合</span>
                <strong>{stageText}</strong>
                <p>{progressData?.study_days ? `${progressData.study_days}日 学習しました` : '学習データを準備中です'}</p>
              </article>

              <article className="eq-family-dashboard-card">
                <span>復習が必要</span>
                <strong>{reviewCount && reviewCount > 0 ? `${reviewCount}問` : 'まだ復習データはありません'}</strong>
                <p>単語・文法・英検の復習を合計しています</p>
              </article>
            </section>
          </>
        ) : (
          <section className="eq-family-panel eq-family-empty">
            <p>子どもプロフィールを作成してください</p>
            <button type="button" onClick={() => navigate('/create-child-profile')}>子どもを追加</button>
          </section>
        )}
      </main>

      <EQBottomNav className="eq-family-bottom-nav" />
    </div>
  );
}
