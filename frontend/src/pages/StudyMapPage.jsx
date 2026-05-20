import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBackPill, EQBottomNav, EQCard, EQMobileShell } from '../components/eigo';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import { EIGO_QUEST_STAGES_PER_WORLD, getEigoQuestProgress } from '../helpers/eigoQuestProgress';

const CHILD_STORAGE_KEY = 'selected_child_id';
const MOCK_LEARNED_WORDS = 42;

export default function StudyMapPage() {
  const navigate = useNavigate();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const [homeData, setHomeData] = useState(null);
  const [error, setError] = useState('');
  const [worldImageFailed, setWorldImageFailed] = useState(false);

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }

    getHomeData(childId)
      .then((payload) => setHomeData(payload))
      .catch((err) => {
        setError(err.message || '学習マップを読み込めませんでした。');
        setHomeData({ mastered_words: MOCK_LEARNED_WORDS });
      });
  }, [childId, navigate]);

  const rawLearnedWords = homeData?.mastered_words ?? homeData?.learned_words ?? homeData?.progress;
  const learnedWordsCount = rawLearnedWords === undefined || rawLearnedWords === null
    ? MOCK_LEARNED_WORDS
    : Number(rawLearnedWords);
  const questProgress = getEigoQuestProgress(learnedWordsCount, eigoQuestWorlds);
  const currentWorld = questProgress.currentWorld;
  const todayWordsDone = Number(homeData?.progress ?? 5);
  const todayWordsTarget = Number(homeData?.target ?? 5);
  const quizDone = Number(homeData?.today_quiz_correct ?? homeData?.quiz_progress ?? 3);
  const quizTarget = Number(homeData?.today_quiz_target ?? 5);
  const wrongReviewDone = Number(homeData?.today_review_done ?? 0);
  const wrongReviewTarget = Number(homeData?.today_review_target ?? 3);

  useEffect(() => {
    setWorldImageFailed(false);
  }, [currentWorld.id]);

  return (
    <div className="eq-study-map-wrap">
      <EQMobileShell className="eq-study-map-screen">
        <EQBackPill to="/app">← ホームに戻る</EQBackPill>

        <header className="eq-study-map-header">
          <p className="eq-caption">学習マップ</p>
          <h1 className="eq-page-title">冒険の地図</h1>
          <p className="eq-caption">
            {questProgress.learnedWords} / {questProgress.totalWords} words
          </p>
        </header>

        {error ? <div className="eq-study-map-error">{error}</div> : null}

        <section className="eq-study-world-scene" style={{ '--world-color': currentWorld.themeColor }}>
          <div className="eq-study-world-image-stage" aria-hidden="true">
            {!worldImageFailed && currentWorld.backgroundImage ? (
              <img
                src={currentWorld.backgroundImage}
                alt=""
                className="eq-decorative-image"
                loading="lazy"
                onError={() => setWorldImageFailed(true)}
              />
            ) : (
              <span>{currentWorld.icon || '✨'}</span>
            )}
          </div>
          <div className="eq-study-world-scene-copy">
            <span className="eq-grammar-label">現在の冒険</span>
            <h2>{currentWorld.nameJa}</h2>
            <p>{currentWorld.subtitleJa}</p>
          </div>
        </section>

        <EQCard className="eq-stage-map-panel eq-current-stage-panel">
          <div className="eq-stage-map-heading">
            <h2>{questProgress.stageLabel}</h2>
            <span>{questProgress.stageInWorld} / {EIGO_QUEST_STAGES_PER_WORLD}</span>
          </div>
          <p className="eq-current-stage-title">現在のミッション</p>
          <div className="eq-current-stage-missions">
            <div>
              <span>単語</span>
              <strong>{todayWordsDone} / {todayWordsTarget}</strong>
            </div>
            <div>
              <span>クイズ</span>
              <strong>{quizDone} / {quizTarget}</strong>
            </div>
            <div>
              <span>まちがい</span>
              <strong>{wrongReviewDone} / {wrongReviewTarget}</strong>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/daily-words')} className="eq-gold-button eq-study-map-cta">
            このステージを進める
          </button>
        </EQCard>
      </EQMobileShell>

      <EQBottomNav
        items={[
          { label: 'ホーム', to: '/app', icon: 'home' },
          { label: '地図', to: '/study-map', icon: 'map', active: true },
          { label: '学習', to: '/daily-words', icon: 'study' },
          { label: 'カード', to: '/cards', icon: 'cards' },
          { label: 'その他', to: '/settings', icon: 'more' },
        ]}
      />
    </div>
  );
}
