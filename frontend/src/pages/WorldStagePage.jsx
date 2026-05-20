import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBackPill, EQCard, EQMobileShell } from '../components/eigo';
import { eigoQuestCards } from '../config/eigoQuestCards';
import eigoQuestWorlds from '../config/eigoQuestWorlds';

const CHILD_STORAGE_KEY = 'selected_child_id';
const MOCK_LEARNED_WORDS = 35;
const WORDS_PER_WORLD = 200;
const WORDS_PER_STAGE = 20;
const STAGES_PER_WORLD = 10;

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

const STAGE_POSITIONS = [
  { x: 52, y: 16 },
  { x: 45, y: 28 },
  { x: 38, y: 41 },
  { x: 56, y: 50 },
  { x: 42, y: 61 },
  { x: 58, y: 69 },
  { x: 45, y: 78 },
  { x: 62, y: 84 },
  { x: 35, y: 88 },
  { x: 55, y: 89 },
];

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
  const worldIndex = clamp(Math.floor(safeLearnedWords / WORDS_PER_WORLD), 0, eigoQuestWorlds.length - 1);
  const currentWorld = eigoQuestWorlds[worldIndex] || eigoQuestWorlds[0];
  const worldDisplay = WORLD_DISPLAY[currentWorld.id] || {
    nameJa: currentWorld.nameJa || '風の世界',
    nameEn: `${String(currentWorld.id || 'wind').toUpperCase()} REALM`,
    symbol: currentWorld.icon || '★',
    color: currentWorld.themeColor || '#45d7ff',
  };

  const rawWorldWords = safeLearnedWords - worldIndex * WORDS_PER_WORLD;
  const learnedWordsInWorld = clamp(rawWorldWords, 0, WORDS_PER_WORLD);
  const currentStage = clamp(Math.floor(learnedWordsInWorld / WORDS_PER_STAGE) + 1, 1, STAGES_PER_WORLD);
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

  const stageNodes = Array.from({ length: STAGES_PER_WORLD }, (_, index) => {
    const stage = index + 1;
    const status = stage < currentStage ? 'completed' : stage === currentStage ? 'current' : 'locked';
    return {
      stage,
      status,
      isBoss: stage === STAGES_PER_WORLD,
      position: STAGE_POSITIONS[index],
    };
  });

  function startCurrentStage() {
    navigate('/daily-words');
  }

  function handleStageTap(stage) {
    if (stage.status === 'current') {
      startCurrentStage();
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
        <EQBackPill to="/app">← ホームに戻る</EQBackPill>

        <header className="eq-world-stage-header">
          <h1>{worldDisplay.nameJa}</h1>
          <p>{worldDisplay.nameEn}</p>
          <div className="eq-world-stage-progress-line">
            <span>Stage {currentStage} / {STAGES_PER_WORLD}</span>
            <strong>{learnedWordsInWorld} / {WORDS_PER_WORLD} words</strong>
          </div>
          <div className="eq-progress-bar" style={{ '--eq-progress': `${worldProgressPercent}%` }} />
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
          <div className="eq-world-stage-path" aria-hidden="true" />
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
      </EQMobileShell>
    </div>
  );
}
