import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBackPill, EQBottomNav, EQCard, EQMobileShell } from '../components/eigo';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import { EIGO_QUEST_STAGES_PER_WORLD, getEigoQuestProgress } from '../helpers/eigoQuestProgress';

const CHILD_STORAGE_KEY = 'selected_child_id';
const MOCK_LEARNED_WORDS = 42;

function getStageStatus(stageNumber, currentStage) {
  if (stageNumber < currentStage) return 'completed';
  if (stageNumber === currentStage) return 'current';
  return 'locked';
}

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

  useEffect(() => {
    setWorldImageFailed(false);
  }, [currentWorld.id]);

  const stageNodes = Array.from({ length: EIGO_QUEST_STAGES_PER_WORLD }, (_, stageIndex) => {
    const stageNumber = stageIndex + 1;
    return {
      stageNumber,
      status: getStageStatus(stageNumber, questProgress.stageInWorld),
      isBoss: stageNumber === EIGO_QUEST_STAGES_PER_WORLD,
    };
  });

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

        <section
          className="eq-study-world-scene"
          style={{
            '--world-color': currentWorld.themeColor,
          }}
        >
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
          <div className="eq-study-world-icon" aria-hidden="true">
            {currentWorld.icon}
          </div>
          <div className="eq-adventure-progress-row">
            <span>{questProgress.stageLabel}</span>
            <strong>{questProgress.stageProgressPercent}%</strong>
          </div>
          <div className="eq-progress-bar" style={{ '--eq-progress': `${questProgress.stageProgressPercent}%` }} />
        </section>

        <EQCard className="eq-stage-map-panel">
          <div className="eq-stage-map-heading">
            <h2>ステージ</h2>
            <span>{questProgress.stageInWorld} / {EIGO_QUEST_STAGES_PER_WORLD}</span>
          </div>

          <div className="eq-stage-node-grid" aria-label={`${currentWorld.nameJa} stages`}>
            {stageNodes.map((stage) => (
              <button
                key={stage.stageNumber}
                type="button"
                className={`eq-stage-node is-${stage.status} ${stage.isBoss ? 'is-boss' : ''}`}
                disabled={stage.status === 'locked'}
                aria-label={`Stage ${stage.stageNumber}${stage.isBoss ? ' boss' : ''}`}
              >
                <span className="eq-stage-node-marker">
                  {stage.isBoss ? 'B' : stage.stageNumber}
                </span>
                <span className="eq-stage-node-label">
                  {stage.isBoss ? 'Boss' : `Stage ${stage.stageNumber}`}
                </span>
              </button>
            ))}
          </div>
        </EQCard>

        <section className="eq-world-mini-strip" aria-label="Worlds">
          {eigoQuestWorlds.map((world, index) => (
            <div
              key={world.id}
              className={`eq-world-mini ${index < questProgress.worldIndex ? 'is-complete' : ''} ${index === questProgress.worldIndex ? 'is-current' : ''}`}
              style={{ '--world-color': world.themeColor }}
            >
              <span>{world.icon}</span>
              <strong>{world.nameJa}</strong>
            </div>
          ))}
        </section>
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
