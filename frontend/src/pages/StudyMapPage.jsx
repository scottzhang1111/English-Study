import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBottomNav, EQMobileShell } from '../components/eigo';
import eigoQuestWorlds, { EIGO_QUEST_TOTAL_WORDS, EIGO_QUEST_WORDS_PER_STAGE } from '../config/eigoQuestWorlds';
import { getEigoQuestProgress } from '../helpers/eigoQuestProgress';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

const CHILD_STORAGE_KEY = 'selected_child_id';
const MOCK_LEARNED_WORDS = 420;

const WORLD_DISPLAY = {
  wind: { nameJa: '風の世界', nameEn: 'WIND REALM', symbol: '風', color: '#45d7ff' },
  fire: { nameJa: '火の世界', nameEn: 'FIRE REALM', symbol: '火', color: '#ff6b3d' },
  water: { nameJa: '水の世界', nameEn: 'WATER REALM', symbol: '水', color: '#4ccfff' },
  thunder: { nameJa: '雷の世界', nameEn: 'THUNDER REALM', symbol: '雷', color: '#8b6bff' },
  wood: { nameJa: '木の世界', nameEn: 'WOOD REALM', symbol: '木', color: '#67d96b' },
  rock: { nameJa: '岩の世界', nameEn: 'ROCK REALM', symbol: '岩', color: '#d7a85b' },
  light: { nameJa: '光の世界', nameEn: 'LIGHT REALM', symbol: '光', color: '#ffd86b' },
  shadow: { nameJa: '影の世界', nameEn: 'SHADOW REALM', symbol: '影', color: '#a569ff' },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getWorldStageLabel(progressWords, world) {
  const stageCount = Number(world?.stageCount || world?.stages || 10);
  const wordCount = Number(world?.wordCount || stageCount * EIGO_QUEST_WORDS_PER_STAGE);
  if (progressWords >= wordCount) return 'クリア';
  if (progressWords <= 0) return `Stage 0 / ${stageCount}`;
  return `Stage ${Math.floor(progressWords / EIGO_QUEST_WORDS_PER_STAGE) + 1} / ${stageCount}`;
}

export default function StudyMapPage() {
  const navigate = useNavigate();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const [homeData, setHomeData] = useState(null);
  const [error, setError] = useState('');
  const [failedImages, setFailedImages] = useState(() => new Set());

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }

    getHomeData(childId)
      .then((payload) => setHomeData(payload))
      .catch((err) => {
        setError(err.message || '学習データを読み込めませんでした。');
        setHomeData({ mastered_words: MOCK_LEARNED_WORDS });
      });
  }, [childId, navigate]);

  const rawLearnedWords = homeData?.mastered_words ?? homeData?.learned_words ?? homeData?.progress;
  const learnedWordsCount = Number.isFinite(Number(rawLearnedWords))
    ? clamp(Number(rawLearnedWords), 0, EIGO_QUEST_TOTAL_WORDS)
    : MOCK_LEARNED_WORDS;
  const currentWorldIndex = getEigoQuestProgress(learnedWordsCount).worldIndex;

  const worlds = eigoQuestWorlds.map((world, index) => {
    const display = WORLD_DISPLAY[world.id] || {
      nameJa: world.nameJa,
      nameEn: `${world.id.toUpperCase()} REALM`,
      symbol: world.icon || '*',
      color: world.themeColor || '#45d7ff',
    };
    const wordCount = Number(world.wordCount || Number(world.stageCount || world.stages || 10) * EIGO_QUEST_WORDS_PER_STAGE);
    const progressWords = clamp(learnedWordsCount - Number(world.wordStartIndex || 0), 0, wordCount);
    const isComplete = progressWords >= wordCount;
    const isCurrent = index === currentWorldIndex && !isComplete;
    const isFuture = progressWords === 0 && !isCurrent;

    return {
      ...world,
      ...display,
      progressWords,
      progressPercent: Math.round((progressWords / wordCount) * 100),
      stageLabel: getWorldStageLabel(progressWords, world),
      status: isComplete ? 'complete' : isCurrent ? 'current' : isFuture ? 'future' : 'active',
    };
  });

  const currentWorld = worlds[currentWorldIndex] || worlds[0];

  function handleImageError(worldId) {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(worldId);
      return next;
    });
  }

  function handleWorldClick(world) {
    if (world.status === 'future') return;
    navigate(`/app/world-stage?world=${world.id}`);
  }

  return (
    <div className="eq-study-map-wrap">
      <EQMobileShell className="eq-study-map-screen eq-world-overview-screen">
        <CompactPageHeader
          title="学習マップ"
          backgroundImage={currentWorld?.backgroundImage}
          helperImage="/assets/eigo-quest/spirit_assets/happy.png"
          guidanceText={[
            '学習の旅を確認しよう',
            '次の目標まで少しずつ進もう',
            'クリアした世界は力を取り戻しているよ',
          ]}
          variant={currentWorld?.id || 'wind'}
        />

        {error ? <div className="eq-study-map-error">{error}</div> : null}

        <section className="eq-world-overview-grid" aria-label="8つの世界">
          {worlds.map((world) => (
            <button
              key={world.id}
              type="button"
              className={`eq-world-overview-card is-${world.status}`}
              style={{ '--world-color': world.color }}
              onClick={() => handleWorldClick(world)}
            >
              <div className="eq-world-overview-bg" aria-hidden="true">
                {!failedImages.has(world.id) && world.backgroundImage ? (
                  <img
                    src={world.backgroundImage}
                    alt=""
                    loading="lazy"
                    onError={() => handleImageError(world.id)}
                  />
                ) : (
                  <span>{world.symbol}</span>
                )}
              </div>
              <div className="eq-world-overview-content">
                <div className="eq-world-symbol-row">
                  <span className="eq-world-symbol">{world.symbol}</span>
                  {world.status === 'current' ? <em>現在の世界</em> : null}
                  {world.status === 'complete' ? <em>クリア</em> : null}
                </div>
                <div className="eq-world-overview-title">
                  <h2>{world.nameJa}</h2>
                </div>
                <div className="eq-world-card-progress">
                  <span style={{ width: `${world.progressPercent}%` }} />
                </div>
              </div>
            </button>
          ))}
        </section>

        <p className="eq-map-bottom-message">全75 Stage、1500 words の冒険を進めよう。</p>
      </EQMobileShell>

      <EQBottomNav className="eq-study-map-bottom-nav" />
    </div>
  );
}
