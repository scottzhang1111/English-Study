import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBottomNav, EQCard, EQMobileShell } from '../components/eigo';
import eigoQuestWorlds from '../config/eigoQuestWorlds';

const CHILD_STORAGE_KEY = 'selected_child_id';
const MOCK_LEARNED_WORDS = 420;
const TOTAL_WORDS_TARGET = 1500;
const WORDS_PER_WORLD = 200;
const STAGES_PER_WORLD = 10;
const WORDS_PER_STAGE = 20;

const WORLD_DISPLAY = {
  wind: { nameJa: '風の世界', nameEn: 'WIND REALM', symbol: '風', color: '#45d7ff' },
  fire: { nameJa: '火の世界', nameEn: 'FIRE REALM', symbol: '火', color: '#ff6b3d' },
  thunder: { nameJa: '雷の世界', nameEn: 'THUNDER REALM', symbol: '雷', color: '#8b6bff' },
  wood: { nameJa: '木の世界', nameEn: 'WOOD REALM', symbol: '木', color: '#67d96b' },
  rock: { nameJa: '岩の世界', nameEn: 'ROCK REALM', symbol: '岩', color: '#d7a85b' },
  shadow: { nameJa: '影の世界', nameEn: 'SHADOW REALM', symbol: '影', color: '#a569ff' },
  water: { nameJa: '水の世界', nameEn: 'WATER REALM', symbol: '水', color: '#4ccfff' },
  light: { nameJa: '光の世界', nameEn: 'LIGHT REALM', symbol: '光', color: '#ffd86b' },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getWorldStageLabel(progressWords) {
  if (progressWords >= WORDS_PER_WORLD) return 'クリア';
  if (progressWords <= 0) return `Stage 0 / ${STAGES_PER_WORLD}`;
  return `Stage ${Math.floor(progressWords / WORDS_PER_STAGE) + 1} / ${STAGES_PER_WORLD}`;
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
    ? clamp(Number(rawLearnedWords), 0, TOTAL_WORDS_TARGET)
    : MOCK_LEARNED_WORDS;

  const currentWorldIndex = Math.min(
    eigoQuestWorlds.length - 1,
    Math.max(0, Math.floor(learnedWordsCount / WORDS_PER_WORLD))
  );

  const worlds = eigoQuestWorlds.map((world, index) => {
    const display = WORLD_DISPLAY[world.id] || {
      nameJa: world.nameJa,
      nameEn: `${world.id.toUpperCase()} REALM`,
      symbol: world.icon || '★',
      color: world.themeColor || '#45d7ff',
    };
    const progressWords = clamp(learnedWordsCount - index * WORDS_PER_WORLD, 0, WORDS_PER_WORLD);
    const isComplete = progressWords >= WORDS_PER_WORLD;
    const isCurrent = index === currentWorldIndex && !isComplete;
    const isFuture = progressWords === 0 && !isCurrent;

    return {
      ...world,
      ...display,
      progressWords,
      progressPercent: Math.round((progressWords / WORDS_PER_WORLD) * 100),
      stageLabel: getWorldStageLabel(progressWords),
      status: isComplete ? 'complete' : isCurrent ? 'current' : isFuture ? 'future' : 'active',
    };
  });

  const clearedWorlds = worlds.filter((world) => world.status === 'complete').length;
  const totalProgressPercent = Math.round((learnedWordsCount / TOTAL_WORDS_TARGET) * 100);

  function handleImageError(worldId) {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(worldId);
      return next;
    });
  }

function handleWorldClick(world) {
  if (world.status === 'future') {
    return;
  }

  navigate(`/app/world-stage?world=${world.id}`);
}

  return (
    <div className="eq-study-map-wrap">
      <EQMobileShell className="eq-study-map-screen eq-world-overview-screen">
        <header className="eq-map-hero-header">
          <div className="eq-map-hero-copy">
            <span className="eq-map-hero-compass" aria-hidden="true">✦</span>
            <div>
              <h1>学習マップ</h1>
              <p>8つの世界から学習するエリアを選ぼう</p>
            </div>
          </div>
          <img
            className="eq-map-hero-spirit"
            src="/assets/eigo-quest/spirit_assets/happy.png"
            alt=""
            aria-hidden="true"
          />
        </header>

        {error ? <div className="eq-study-map-error">{error}</div> : null}

        <EQCard className="eq-map-summary-card">
          <div className="eq-map-summary-row">
            <div>
              <span>総進行</span>
              <strong>{learnedWordsCount} / {TOTAL_WORDS_TARGET} words</strong>
            </div>
            <div>
              <span>クリアした世界</span>
              <strong>{clearedWorlds} / {worlds.length}</strong>
            </div>
          </div>
          <div className="eq-map-total-progress">
            <span style={{ width: `${totalProgressPercent}%` }} />
          </div>
        </EQCard>

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
                  {world.status === 'complete' ? <em>✓ クリア</em> : null}
                </div>
                <div className="eq-world-overview-title">
                  <h2>{world.nameJa}</h2>
                </div>
                <div className="eq-world-overview-meta">
                  <strong>{world.stageLabel}</strong>
                  <span>{world.progressWords} / {WORDS_PER_WORLD} words</span>
                </div>
                <div className="eq-world-card-progress">
                  <span style={{ width: `${world.progressPercent}%` }} />
                </div>
              </div>
            </button>
          ))}
        </section>

        <p className="eq-map-bottom-message">各世界で 200 words + 文法練習 を学べるよ！</p>
      </EQMobileShell>

{/*       <EQBottomNav
        items={[
          { label: 'ホーム', to: '/app', icon: 'home' },
          { label: '地図', to: '/app/study-map', icon: 'map', active: true },
          { label: '学習', to: '/daily-words', icon: 'study' },
          { label: 'カード', to: '/cards', icon: 'cards' },
          { label: 'その他', to: '/settings', icon: 'more' },
        ]}
      /> */}
      <EQBottomNav className="eq-study-map-bottom-nav" />
    </div>
  );
}
