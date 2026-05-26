import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBackPill, EQCard, EQMobileShell, EQBottomNav } from '../components/eigo';
import { eigoQuestCards } from '../config/eigoQuestCards';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import SpiritAssistant from '../components/eigo-quest/SpiritAssistant';

const CHILD_STORAGE_KEY = 'selected_child_id';
const MOCK_LEARNED_WORDS = 35;
const WORDS_PER_WORLD = 200;
const WORDS_PER_STAGE = 20;
const STAGES_PER_WORLD = 10;

const WORLD_DISPLAY = {
  wind: {
    nameJa: '風の世界',
    nameEn: 'WIND REALM',
    symbol: '風',
    color: '#45d7ff',
    intro: '白雲と浮島がそびえ、自由な嵐が吹き抜ける天空の魔法世界。',
  },
  fire: {
    nameJa: '火の世界',
    nameEn: 'FIRE REALM',
    symbol: '火',
    color: '#ff6b3d',
    intro: '滾る溶岩が地を刻み、灼熱の炎が年中燃え盛る情熱の火山世界。',
  },
  water: {
    nameJa: '水の世界',
    nameEn: 'WATER REALM',
    symbol: '水',
    color: '#4ccfff',
    intro: '神秘の珊瑚が輝き、美しい深海が無限に広がる静謐な水の楽園。',
  },
  thunder: {
    nameJa: '雷の世界',
    nameEn: 'THUNDER REALM',
    symbol: '雷',
    color: '#8b6bff',
    intro: '稲妻が激しく轟き、紫の電撃が縦横無尽に走るスリリングな世界。',
  },
  wood: {
    nameJa: '木の世界',
    nameEn: 'WOOD REALM',
    symbol: '木',
    color: '#67d96b',
    intro: '千年樹が緑を広げ、可愛い精霊が暮らす神秘的な大自然の聖域。',
  },
  rock: {
    nameJa: '岩の世界',
    nameEn: 'ROCK REALM',
    symbol: '岩',
    color: '#d7a85b',
    intro: '険しい岩山が連なり、輝く鉱石が地底に眠る堅牢な大地の世界。',
  },
  light: {
    nameJa: '光の世界',
    nameEn: 'LIGHT REALM',
    symbol: '光',
    color: '#ffd86b',
    intro: '聖なる光が降り注ぎ、邪悪を優しく浄化する黄金の輝かしい世界。',
  },
  shadow: {
    nameJa: '影の世界',
    nameEn: 'SHADOW REALM',
    symbol: '影',
    color: '#a569ff',
    intro: '漆黒の闇が支配し、妖しい影が蠢く静寂な常闇の王国。',
  },
};

const WORLD_STAGE_POSITIONS = {
fire: [
 { x: 14, y: 72 }, // 1 current
  { x: 25, y: 58 }, // 2 左上平台
  { x: 35, y: 48 }, // 3 左上中平台
  { x: 48, y: 39 }, // 4 中上平台
  { x: 68, y: 31 }, // 5 右上平台
  { x: 59, y: 53 }, // 6 中右平台
  { x: 46, y: 65 }, // 7 中下平台
  { x: 56, y: 78 }, // 8 下中右
  { x: 33, y: 84 }, // 9 左下
  { x: 80, y: 80 }, // 10 boss
],

  wind: [
    { x: 18, y: 78 },
    { x: 31, y: 64 },
    { x: 24, y: 49 },
    { x: 42, y: 38 },
    { x: 62, y: 32 },
    { x: 78, y: 45 },
    { x: 64, y: 60 },
    { x: 48, y: 72 },
    { x: 32, y: 84 },
    { x: 78, y: 82 },
  ],
};
const WORLD_STAGE_PATHS = {
  fire:
  'M 14 72 C 17 66, 21 61, 25 58 C 29 54, 32 51, 35 48 C 39 44, 43 41, 48 39 C 55 35, 62 33, 68 31 C 66 40, 63 47, 59 53 C 54 58, 50 62, 46 65 C 49 71, 53 75, 56 78 C 49 81, 41 83, 33 84 C 50 84, 67 83, 82 82',
  wind:
    'M 18 78 C 28 68, 38 70, 31 64 C 20 54, 18 46, 24 49 C 35 54, 32 40, 42 38 C 56 35, 66 22, 62 32 C 58 48, 75 35, 78 45 C 82 58, 66 54, 64 60 C 60 72, 48 72, 48 72 C 42 80, 34 84, 32 84 C 52 90, 68 88, 78 82',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function missionProgress(done, target, suffix = '') {
  const safeTarget = Math.max(1, Number(target) || 1);
  const safeDone = Math.max(0, Number(done) || 0);
  if (safeDone >= safeTarget) {
    return { status: 'CLEAR!', detail: suffix ? `${safeDone} ${suffix}` : '' };
  }
  return { status: `${safeDone} / ${safeTarget}`, detail: '' };
}

export default function WorldStagePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const [homeData, setHomeData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

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

  const learnedWords = Number(homeData?.mastered_words ?? homeData?.learned_words ?? homeData?.progress ?? MOCK_LEARNED_WORDS);
  const safeLearnedWords = Number.isFinite(learnedWords) ? Math.max(0, learnedWords) : MOCK_LEARNED_WORDS;
  const progressWorldIndex = clamp(Math.floor(safeLearnedWords / WORDS_PER_WORLD), 0, eigoQuestWorlds.length - 1);
  const requestedWorldId = searchParams.get('world');
  const requestedWorldIndex = eigoQuestWorlds.findIndex((world) => world.id === requestedWorldId);
  const canOpenRequestedWorld = requestedWorldIndex >= 0 && requestedWorldIndex <= progressWorldIndex;
  const worldIndex = canOpenRequestedWorld ? requestedWorldIndex : progressWorldIndex;
  const currentWorld = eigoQuestWorlds[worldIndex] || eigoQuestWorlds[0];
  const worldDisplay = WORLD_DISPLAY[currentWorld.id] || {
    nameJa: currentWorld.nameJa || '風の世界',
    nameEn: `${String(currentWorld.id || 'wind').toUpperCase()} REALM`,
    symbol: currentWorld.icon || '★',
    color: currentWorld.themeColor || '#45d7ff',
  };

  const rawWorldWords = safeLearnedWords - worldIndex * WORDS_PER_WORLD;
  const learnedWordsInWorld = clamp(rawWorldWords, 0, WORDS_PER_WORLD);
  const isSelectedWorldComplete = learnedWordsInWorld >= WORDS_PER_WORLD;
  const currentStage = isSelectedWorldComplete
    ? STAGES_PER_WORLD
    : clamp(Math.floor(learnedWordsInWorld / WORDS_PER_STAGE) + 1, 1, STAGES_PER_WORLD);
  const worldProgressPercent = Math.round((learnedWordsInWorld / WORDS_PER_WORLD) * 100);
  const todayWordsDone = Number(homeData?.progress ?? 6);
  const todayWordsTarget = Number(homeData?.target ?? 20);
  const quizDone = Number(homeData?.today_quiz_correct ?? homeData?.quiz_progress ?? 3);
  const quizTarget = Number(homeData?.today_quiz_target ?? 5);
  const wrongReviewDone = Number(homeData?.today_review_done ?? 0);
  const wrongReviewTarget = Number(homeData?.today_review_target ?? 3);

  const stageStarted = learnedWordsInWorld > (currentStage - 1) * WORDS_PER_STAGE;
  const stageCompleted = learnedWordsInWorld >= currentStage * WORDS_PER_STAGE;
  const stageCtaLabel = stageCompleted ? '次のステージへ' : stageStarted ? `Stage ${currentStage} をつづける` : `Stage ${currentStage} を始める`;
  const rewardCard = eigoQuestCards.find((card) => card.worldId === currentWorld.id) || eigoQuestCards[0];
  const rewardCardName = currentWorld.id === 'wind' ? 'そよ風の精霊カード' : `${rewardCard?.nameJa || '精霊カード'}`;
  const missionRows = [
    { icon: '📖', label: '単語', ...missionProgress(todayWordsDone, todayWordsTarget, 'words') },
    { icon: '🪶', label: '文法', ...missionProgress(0, 1) },
    { icon: '？', label: 'クイズ', ...missionProgress(quizDone, quizTarget) },
    { icon: '🔎', label: 'まちがい直し', ...missionProgress(wrongReviewDone, wrongReviewTarget) },
  ];
  const stagePositions =
  WORLD_STAGE_POSITIONS[currentWorld.id] ||
  WORLD_STAGE_POSITIONS.fire;

  useEffect(() => {
    setImageFailed(false);
  }, [currentWorld.id]);

  const stageNodes = Array.from({ length: STAGES_PER_WORLD }, (_, index) => {
    const stage = index + 1;
    const status = isSelectedWorldComplete
      ? 'completed'
      : stage < currentStage
        ? 'completed'
        : stage === currentStage
          ? 'current'
          : 'locked';
    return {
      stage,
      status,
      isBoss: stage === STAGES_PER_WORLD,
      position: stagePositions[index],
    };
  });

  function openStageWords(stageNumber = currentStage) {
    navigate(`/daily-words?world=${encodeURIComponent(currentWorld.id)}&stage=${encodeURIComponent(stageNumber)}`);
  }

  function startCurrentStage() {
    openStageWords(currentStage);
  }

  function handleStageTap(stage) {
    if (stage.status === 'current' || stage.status === 'completed') {
      openStageWords(stage.stage);
      return;
    }
    if (stage.status === 'locked') {
      setMessage('前のステージをクリアすると解放されます');
      window.setTimeout(() => setMessage(''), 2200);
    }
  }

  return (
    <div className="eq-world-stage-wrap">
      <EQMobileShell className="eq-world-stage-screen">
<header className={`eq-world-stage-story-header is-${currentWorld.id}`} style={{ '--world-color': worldDisplay.color }}>
  <div className="eq-world-title-frame">
    <span className="eq-world-title-gem eq-world-title-gem--top" aria-hidden="true" />
    <h1>{worldDisplay.nameJa.replace('世界', '国')}</h1>
    <span className="eq-world-title-gem eq-world-title-gem--bottom" aria-hidden="true" />
  </div>

  <p className="eq-world-stage-intro">
    {worldDisplay.intro || 'さあ、冒険の旅に出よう！'}
  </p>
</header>

        {error ? <div className="eq-study-map-error">{error}</div> : null}
        {message ? <div className="eq-stage-toast">{message}</div> : null}

        <section className="eq-world-stage-map-card" style={{ '--world-color': worldDisplay.color }}>
          <div className="eq-world-stage-map-bg" aria-hidden="true">
            {!imageFailed && currentWorld.backgroundImage ? (
              <img
                src={currentWorld.backgroundImage}
                alt=""
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span>{worldDisplay.symbol}</span>
            )}
          </div>
          <svg
            className="eq-world-stage-route-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="eq-world-stage-route-shadow"
              d={WORLD_STAGE_PATHS[currentWorld.id] || WORLD_STAGE_PATHS.fire}
            />
            <path
              className="eq-world-stage-route-line"
              d={WORLD_STAGE_PATHS[currentWorld.id] || WORLD_STAGE_PATHS.fire}
            />
          </svg>
          {stageNodes.map((node) => (
            <button
              key={node.stage}
              type="button"
              className={`eq-stage-select-node is-${node.status} ${node.isBoss ? 'is-boss' : ''}`}
              style={{
                '--node-x': `${node.position.x}%`,
                '--node-y': `${node.position.y}%`,
              }}
              onClick={() => handleStageTap(node)}
              aria-label={`Stage ${node.stage}`}
            >
              <span>{node.status === 'completed' ? '✓' : node.status === 'locked' ? '🔒' : node.stage}</span>
              {node.status === 'current' ? <em>現在</em> : null}
              {node.isBoss ? <strong>Boss</strong> : null}
            </button>
          ))}
        </section>  
        <section className="eq-world-stage-guide-area">
  <div className="eq-world-stage-bubble">
    <span>{worldDisplay.nameJa.replace('世界', '国')}</span>

  </div>

<SpiritAssistant
  worldName={worldDisplay.nameJa.replace('世界', '国')}
  mood="idle"
  position="stage-map"
  messages={[
    `ここは「${worldDisplay.nameJa.replace('世界', '国')}」だよ。\nStage ${currentStage} に挑戦しよう！`,
  ]}
/>
</section>

{/* <button
  type="button"
  className="eq-gold-button eq-stage-start-button eq-stage-start-button-main"
  onClick={startCurrentStage}
>
  Stage {currentStage} 挑戦
</button> */}
{false && (
        <EQCard className="eq-stage-mission-panel">
          <h2>Stage {currentStage} のミッション</h2>
          <div className="eq-stage-mission-list">
            {missionRows.map((item) => (
              <div key={item.label}>
                <span><b>{item.icon}</b>{item.label}</span>
                <strong className={item.status === 'CLEAR!' ? 'is-clear' : ''}>
                  {item.status}
                  {item.detail ? <small>{item.detail}</small> : null}
                </strong>
              </div>
            ))}
          </div>
          <div className="eq-stage-reward-preview">
            <span>クリア報酬</span>
            <strong>{rewardCardName}</strong>
            <div>
              <small>EXP +50</small>
              <small>Coin +30</small>
            </div>
          </div>
          <button type="button" className="eq-gold-button eq-stage-start-button" onClick={startCurrentStage}>
            {stageCtaLabel}
          </button>
        </EQCard>
        )}
{/*         <EQBottomNav
          className="eq-world-stage-bottom-nav"
          items={[
            { label: 'ホーム', to: '/app', icon: 'home' },
            { label: '世界地図', to: '/study-map', icon: 'map', active: true },
            { label: '学習', to: '/daily-words', icon: 'study' },
            { label: 'カード', to: '/cards', icon: 'cards' },
            { label: 'その他', to: '/settings', icon: 'more' },
          ]}
        /> */}
        <EQBottomNav className="eq-world-stage-bottom-nav" />
      </EQMobileShell>
    </div>
  );
}
