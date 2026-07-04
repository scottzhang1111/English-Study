import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBackPill, EQCard, EQMobileShell, EQBottomNav, EQStageNode } from '../components/eigo';
import { eigoQuestCards } from '../config/eigoQuestCards';
import eigoQuestWorlds, { EIGO_QUEST_WORDS_PER_STAGE } from '../config/eigoQuestWorlds';
import { EIGO_BOSSES, EIGO_BOSS_TYPES, getEigoBossBattleRoute, getEigoBossesByWorld } from '../data/eigoBosses';
import { WORLD_STAGE_NODE_TYPES, getWorldStageLayout } from '../data/worldStageLayouts';
import { isBossCleared } from '../helpers/eigoBossProgress';
import { getMapDebugMode } from '../helpers/mapDebugMode';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import {
  getBossNodeState,
  getStageNodeState,
  hasStageCleared,
  hasStageInProgress,
} from '../helpers/eigoWorldStageState';

const CHILD_STORAGE_KEY = 'selected_child_id';
const MOCK_LEARNED_WORDS = 35;

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
    { x: 73.7, y: 83.5 },
    { x: 74.5, y: 68.4 },
    { x: 53.7, y: 57.2 },
    { x: 33.6, y: 56.5 },
    { x: 43.5, y: 42.8 },
    { x: 70.2, y: 41.6 },
    { x: 74.0, y: 30.0 },
    { x: 55.5, y: 25.9 },
    { x: 16.9, y: 10.1 },
    { x: 46.8, y: 7.8 },
  ],
};
const WORLD_BOSS_CHECKPOINT_POSITIONS = {
  wind: {
    4: { x: 17.1, y: 34.0 },
    8: { x: 34.1, y: 20.5 },
    10: { x: 89.7, y: 18.4 },
  },
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

function getBlockingBossForStage(worldId, stageNumber) {
  return EIGO_BOSSES.find((boss) => {
    if (boss.worldId !== worldId) return false;
    if (!boss.progressGate) return false;
    if (boss.progressGate.gateType !== 'stage_progress') return false;

    const blocksFrom = Number(boss.progressGate.blocksStagesFrom || boss.progressGate.unlocksStagesFrom || 0);
    if (!blocksFrom) return false;

    return Number(stageNumber) >= blocksFrom && !isBossCleared(boss.bossId);
  }) || null;
}

function getStageProgressStatus(currentWorldProgress, stageNumber, worldId) {
  const stageProgress = currentWorldProgress.stages?.find((item) => Number(item.stage) === Number(stageNumber));
  const rawStatus = stageProgress?.status || (worldId === 'wind' && Number(stageNumber) === 1 ? 'current' : 'locked');
  return {
    stageProgress,
    rawStatus,
    status: rawStatus === 'cleared' ? 'completed' : rawStatus,
  };
}

function isStageCleared(currentWorldProgress, stageNumber) {
  return hasStageCleared(currentWorldProgress, 'ignored-world-id', stageNumber);
}

function isBossCheckpointUnlocked(bossConfig, currentWorldProgress, worldId) {
  return getBossNodeState(currentWorldProgress, worldId, bossConfig) === 'available';
}

function getBossConfigForLayoutNode(bosses, layoutNode) {
  if (layoutNode.nodeType === WORLD_STAGE_NODE_TYPES.MINI_BOSS) {
    return bosses.find((boss) => (
      boss.bossType === EIGO_BOSS_TYPES.MINI_BOSS
      && Number(boss.checkpointAfterStage) === Number(layoutNode.stageId)
    ));
  }
  if (layoutNode.nodeType === WORLD_STAGE_NODE_TYPES.WORLD_BOSS) {
    return bosses.find((boss) => (
      boss.bossType === EIGO_BOSS_TYPES.WORLD_BOSS
      && Number(boss.checkpointAfterStage) === Number(layoutNode.stageId)
    ));
  }
  return null;
}

function getBossCheckpointPosition(worldId, bossConfig, stagePositions) {
  const checkpointStage = Number(bossConfig.checkpointAfterStage || 0);
  const configuredPosition = WORLD_BOSS_CHECKPOINT_POSITIONS[worldId]?.[checkpointStage];
  if (configuredPosition) return configuredPosition;

  const anchor = stagePositions[checkpointStage - 1] || stagePositions[stagePositions.length - 1] || { x: 50, y: 50 };
  return {
    x: clamp(anchor.x + 7, 8, 92),
    y: clamp(anchor.y - 5, 8, 92),
  };
}

function getDebugRoutePath(nodes) {
  const routeNodes = nodes
    .filter((node) => node.position)
    .sort((a, b) => a.routeOrder - b.routeOrder);
  if (!routeNodes.length) return '';
  return routeNodes
    .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.position.x} ${node.position.y}`)
    .join(' ');
}

function getDebugNodeLabel(node) {
  if (!node.isBoss) return `Stage ${node.stageId || node.stage}`;
  return `Stage ${node.stageId || node.checkpointAfterStage} ${node.nodeType}`;
}

function formatCoordinate(value) {
  return Number(value).toFixed(1);
}

function getStageNodeType(nodeType) {
  if (nodeType === 'mini_boss') return 'mini_boss';
  if (nodeType === 'world_boss') return 'boss';
  return 'stage';
}

function getStageNodeSize(node) {
  if (node.nodeType === 'world_boss') return 'lg';
  if (node.nodeType === 'mini_boss') return 'md';
  return 'sm';
}

function getStageNodeNumber(node) {
  if (node.nodeType === 'mini_boss') {
    const match = String(node.displayLabel || '').match(/\d+/);
    return match ? Number(match[0]) : undefined;
  }
  if (node.nodeType === 'world_boss') return undefined;
  return node.stageId;
}

function getDebugPositionEntries(nodes, overrides = {}) {
  return nodes
    .filter((node) => node.position)
    .sort((a, b) => a.routeOrder - b.routeOrder)
    .map((node) => {
      const position = overrides[node.id] || node.position;
      return {
        stageId: Number(node.stageId || node.checkpointAfterStage || node.stage),
        nodeType: node.nodeType,
        x: Number(formatCoordinate(position.x)),
        y: Number(formatCoordinate(position.y)),
      };
    });
}

function printDebugPosition(node, nodes, overrides, worldId) {
  const position = overrides[node.id] || node.position;
  console.log(`${getDebugNodeLabel(node)}: x=${formatCoordinate(position.x)}, y=${formatCoordinate(position.y)}`);
  const entries = getDebugPositionEntries(nodes, overrides);
  const copyText = `[\n${entries.map((entry) => {
    return `  { stageId: ${entry.stageId}, nodeType: "${entry.nodeType}", x: ${entry.x}, y: ${entry.y} }`;
  }).join(',\n')}\n]`;
  console.log(`${worldId} layout:`);
  console.log(copyText);
}

export default function WorldStagePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapCardRef = useRef(null);
  const debugDidDragRef = useRef(false);
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const isMapDebugMode = getMapDebugMode();
  const [homeData, setHomeData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [debugNodePositions, setDebugNodePositions] = useState({});

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }

    getHomeData(childId)
      .then((payload) => setHomeData(payload))
      .catch((err) => {
        setError(err.message || '学習データを読み込めませんでした。');
        setHomeData(null);
      });
  }, [childId, navigate]);

  const questProgress = homeData?.eigo_quest_progress || {};
  const requestedWorldId = searchParams.get('world');
  const requestedWorld = eigoQuestWorlds.find((world) => world.id === requestedWorldId);
  const requestedWorldProgress = questProgress.worlds?.find((world) => world.id === requestedWorldId);
  const canOpenRequestedWorld = Boolean(requestedWorldProgress?.unlocked) || (isMapDebugMode && Boolean(requestedWorld));
  const activeWorldId = canOpenRequestedWorld
    ? requestedWorldId
    : questProgress.mainline_complete
      ? 'shadow'
      : (questProgress.current_world || 'wind');
  const currentWorld = eigoQuestWorlds.find((world) => world.id === activeWorldId) || eigoQuestWorlds[0];
  const currentWorldProgress = questProgress.worlds?.find((world) => world.id === currentWorld.id) || {};
  const worldStageCount = Number(currentWorldProgress.stage_count || currentWorld.stageCount || currentWorld.stages || 10);
  const worldWordCount = Number(currentWorldProgress.word_count || currentWorld.wordCount || worldStageCount * EIGO_QUEST_WORDS_PER_STAGE);
  const worldDisplay = WORLD_DISPLAY[currentWorld.id] || {
    nameJa: currentWorld.nameJa || '風の世界',
    nameEn: `${String(currentWorld.id || 'wind').toUpperCase()} REALM`,
    symbol: currentWorld.icon || '★',
    color: currentWorld.themeColor || '#45d7ff',
  };

  const learnedWordsInWorld = clamp(Number(currentWorldProgress.cleared_stage_count || 0) * EIGO_QUEST_WORDS_PER_STAGE, 0, worldWordCount);
  const currentStage = currentWorld.id === questProgress.current_world
    ? clamp(Number(questProgress.current_stage || 1), 1, worldStageCount)
    : worldStageCount;
  const worldProgressPercent = Math.round((learnedWordsInWorld / worldWordCount) * 100);
  const todayWordsDone = Number(homeData?.progress ?? 6);
  const todayWordsTarget = Number(homeData?.target ?? 20);
  const quizDone = Number(homeData?.today_quiz_correct ?? homeData?.quiz_progress ?? 3);
  const quizTarget = Number(homeData?.today_quiz_target ?? 5);
  const wrongReviewDone = Number(homeData?.today_review_done ?? 0);
  const wrongReviewTarget = Number(homeData?.today_review_target ?? 3);

  const stageStarted = Boolean(currentWorldProgress.stages?.some((stage) => stage.status === 'current' || stage.status === 'cleared'));
  const stageCompleted = Boolean(currentWorldProgress.cleared);
  const stageCtaLabel = questProgress.mainline_complete && currentWorld.id === 'shadow'
    ? 'メインクエストクリア'
    : stageCompleted
      ? 'クリア済みステージ'
      : stageStarted
        ? `Stage ${currentStage} をつづける`
        : `Stage ${currentStage} を始める`;
  const rewardCard = eigoQuestCards.find((card) => card.worldId === currentWorld.id) || eigoQuestCards[0];
  const rewardCardName = currentWorld.id === 'wind' ? 'そよ風の精霊カード' : `${rewardCard?.nameJa || '精霊カード'}`;
  const missionRows = [
    { icon: '📖', label: '単語', ...missionProgress(todayWordsDone, todayWordsTarget, 'words') },
    { icon: '🪶', label: '文法', ...missionProgress(0, 1) },
    { icon: '？', label: 'クイズ', ...missionProgress(quizDone, quizTarget) },
    { icon: '🔎', label: 'まちがい直し', ...missionProgress(wrongReviewDone, wrongReviewTarget) },
  ];
  const worldStageLayout = getWorldStageLayout(currentWorld.id);
  const worldBosses = getEigoBossesByWorld(currentWorld.id);

  useEffect(() => {
    setImageFailed(false);
    setDebugNodePositions({});
  }, [currentWorld.id]);

  const stageNodes = worldStageLayout.map((layoutNode, index) => {
    if (layoutNode.nodeType === WORLD_STAGE_NODE_TYPES.STAGE) {
      const stage = Number(layoutNode.stageId);
      const { stageProgress, status: normalizedStatus } = getStageProgressStatus(currentWorldProgress, stage, currentWorld.id);
      const computedStageState = getStageNodeState(currentWorldProgress, currentWorld.id, stage);
      const normalizedStatusForMap = computedStageState === 'in_progress' ? 'current' : computedStageState;
      const blockingBoss = getBlockingBossForStage(currentWorld.id, stage);
      const isLockedByBossGate = !isMapDebugMode && Boolean(blockingBoss) && computedStageState === 'locked';
      const gatedStatus = isLockedByBossGate ? 'locked' : normalizedStatusForMap;
      const status = isMapDebugMode && gatedStatus === 'locked' ? 'active' : gatedStatus;

      return {
        id: `${currentWorld.id}-${stage}-stage`,
        stageId: stage,
        nodeType: WORLD_STAGE_NODE_TYPES.STAGE,
        stage,
        displayLabel: stage,
        status,
        unlocked: isMapDebugMode || (!isLockedByBossGate && Boolean(stageProgress?.unlocked || status === 'completed' || status === 'current' || computedStageState !== 'locked')),
        isBoss: false,
        isMiniBoss: false,
        isLockedByBossGate,
        blockingBoss,
        bossId: null,
        bossRoute: null,
        bossLabel: '',
        title: `Stage ${stage}`,
        position: { x: layoutNode.x, y: layoutNode.y },
        routeOrder: index,
      };
    }

    const bossConfig = getBossConfigForLayoutNode(worldBosses, layoutNode);
    if (!bossConfig) return null;

    const miniBossNumber = worldBosses
      .filter((boss) => boss.bossType === EIGO_BOSS_TYPES.MINI_BOSS)
      .findIndex((boss) => boss.bossId === bossConfig.bossId) + 1;
    const bossCleared = isBossCleared(bossConfig.bossId);
    const computedBossState = getBossNodeState(currentWorldProgress, currentWorld.id, bossConfig);
    const checkpointUnlocked = computedBossState === 'available' || computedBossState === 'cleared';
    const status = bossCleared ? 'completed' : checkpointUnlocked ? 'current' : isMapDebugMode ? 'active' : 'locked';

    return {
      id: `${currentWorld.id}-${layoutNode.stageId}-${layoutNode.nodeType}`,
      stageId: Number(layoutNode.stageId),
      nodeType: layoutNode.nodeType,
      stage: `boss-${index + 1}`,
      checkpointAfterStage: bossConfig.checkpointAfterStage,
      displayLabel: bossConfig.bossType === EIGO_BOSS_TYPES.WORLD_BOSS ? 'B' : `M${miniBossNumber || 1}`,
      status,
      unlocked: isMapDebugMode || checkpointUnlocked,
      isBoss: true,
      isMiniBoss: bossConfig.bossType === EIGO_BOSS_TYPES.MINI_BOSS,
      isLockedByBossGate: false,
      isBossCheckpointLocked: !isMapDebugMode && !checkpointUnlocked,
      blockingBoss: null,
      bossId: bossConfig.bossId,
      bossRoute: getEigoBossBattleRoute(bossConfig.bossId),
      bossLabel: bossConfig.bossType === EIGO_BOSS_TYPES.WORLD_BOSS ? 'World Boss' : 'Mini Boss',
      title: bossConfig.nameJa,
      position: { x: layoutNode.x, y: layoutNode.y },
      routeOrder: index,
    };
  }).filter(Boolean).map((node) => ({
    ...node,
    position: isMapDebugMode && debugNodePositions[node.id]
      ? debugNodePositions[node.id]
      : node.position,
  }));
  function openStageWords(stageNumber = currentStage) {
    navigate(`/daily-words?world=${encodeURIComponent(currentWorld.id)}&stage=${encodeURIComponent(stageNumber)}`);
  }

  function startCurrentStage() {
    const targetStage = stageNodes.find((stage) => stage.status === 'current') || stageNodes.find((stage) => stage.status === 'completed');
    if (targetStage) {
      openStageWords(targetStage.stage);
    }
  }

  function handleStageTap(stage) {
    if (isMapDebugMode && debugDidDragRef.current) {
      debugDidDragRef.current = false;
      return;
    }

    if (isMapDebugMode) {
      if (stage.bossRoute) {
        navigate(stage.bossRoute);
        return;
      }
      openStageWords(stage.stage);
      return;
    }

    if (stage.isBossCheckpointLocked) {
      setMessage('先に前のStageをクリアするとBossに挑戦できるよ！');
      window.setTimeout(() => setMessage(''), 2200);
      return;
    }
    if (stage.isLockedByBossGate) {
      setMessage(stage.blockingBoss?.progressGate?.messageJa || 'Bossをクリアすると次のStageが開くよ！');
      window.setTimeout(() => setMessage(''), 2200);
      return;
    }
    if (stage.bossRoute) {
      navigate(stage.bossRoute);
      return;
    }
    if (stage.unlocked) {
      openStageWords(stage.stage);
      return;
    }
    if (stage.status === 'locked') {
      setMessage('前のステージをクリアすると解放されます');
      window.setTimeout(() => setMessage(''), 2200);
    }
  }

  function handleDebugNodePointerDown(event, node) {
    if (!isMapDebugMode) return;
    const mapElement = mapCardRef.current;
    if (!mapElement) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    debugDidDragRef.current = false;
    let hasDragged = false;
    const startPoint = { x: event.clientX, y: event.clientY };

    const updateNodePosition = (clientX, clientY) => {
      const rect = mapElement.getBoundingClientRect();
      const nextPosition = {
        x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
        y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
      };
      setDebugNodePositions((current) => ({
        ...current,
        [node.id]: nextPosition,
      }));
      return nextPosition;
    };

    const handlePointerMove = (moveEvent) => {
      const distanceX = Math.abs(moveEvent.clientX - startPoint.x);
      const distanceY = Math.abs(moveEvent.clientY - startPoint.y);
      if (!hasDragged && distanceX < 2 && distanceY < 2) return;
      hasDragged = true;
      debugDidDragRef.current = true;
      updateNodePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = (upEvent) => {
      if (hasDragged) {
        const finalPosition = updateNodePosition(upEvent.clientX, upEvent.clientY);
        const finalOverrides = {
          ...debugNodePositions,
          [node.id]: finalPosition,
        };
        printDebugPosition({ ...node, position: finalPosition }, stageNodes, finalOverrides, currentWorld.id);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  if (!homeData && !error) {
    return (
      <div className="eq-world-stage-wrap">
        <EQMobileShell className="eq-world-stage-screen">
          <CompactPageHeader
            title="冒険を準備中"
            subtitle="学習データを読み込んでいます"
            helperImage="/assets/eigo-quest/spirit_assets/happy.png"
            variant="loading"
          />
          <EQCard className="eq-stage-mission-panel">
            <p className="eq-caption text-center">正しい世界を確認しています...</p>
          </EQCard>
          <EQBottomNav className="eq-world-stage-bottom-nav" />
        </EQMobileShell>
      </div>
    );
  }

  return (
    <div className="eq-world-stage-wrap">
      <EQMobileShell className="eq-world-stage-screen">
        <CompactPageHeader
          title={worldDisplay.nameJa}
          backgroundImage={currentWorld.backgroundImage}
          helperImage="/assets/eigo-quest/spirit_assets/happy.png"
          guidanceText={[
            '今のStageを確認しよう',
            'Bossに近づいているよ',
            '一歩ずつ進めば大丈夫',
          ]}
          variant={currentWorld.id}
        />

        {error ? <div className="eq-study-map-error">{error}</div> : null}
        {message ? <div className="eq-stage-toast">{message}</div> : null}

        <section
          ref={mapCardRef}
          className={`eq-world-stage-map-card ${isMapDebugMode ? 'is-position-debug' : ''}`}
          style={{ '--world-color': worldDisplay.color }}
        >
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
          {stageNodes.map((node) => (
            <EQStageNode
              key={`${currentWorld.id}-${node.stageId}-${node.nodeType}`}
              type={getStageNodeType(node.nodeType)}
              state={node.status}
              size={getStageNodeSize(node)}
              number={getStageNodeNumber(node)}
              isCurrent={node.status === 'current'}
              label={node.isBoss ? node.bossLabel : ''}
              className={`eq-stage-select-node is-${node.status} ${node.isBoss ? 'is-boss' : ''} ${node.isMiniBoss ? 'is-mini-boss' : ''} ${isMapDebugMode ? 'is-position-debug' : ''}`}
              style={{
                '--node-x': `${node.position.x}%`,
                '--node-y': `${node.position.y}%`,
              }}
              onPointerDown={(event) => handleDebugNodePointerDown(event, node)}
              onClick={() => handleStageTap(node)}
              aria-label={node.isBoss ? `${node.title} ${node.bossLabel}` : `Stage ${node.stage}`}
            />
          ))}
        </section>
        {false && <section className="eq-world-stage-guide-area">
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
</section>}

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
            { label: '世界地図', to: '/app/study-map', icon: 'map', active: true },
            { label: '学習', to: '/learning-hub', icon: 'study' },
            { label: 'カード', to: '/cards', icon: 'cards' },
            { label: 'その他', to: '/settings', icon: 'more' },
          ]}
        /> */}
        <EQBottomNav className="eq-world-stage-bottom-nav" />
      </EQMobileShell>
    </div>
  );
}
