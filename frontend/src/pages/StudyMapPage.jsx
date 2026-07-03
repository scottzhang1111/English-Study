import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBottomNav, EQMobileShell } from '../components/eigo';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import BgmToggle from '../components/eigo/BgmToggle';
import { BGM_PROMPT_SEEN_STORAGE_KEY, useBgm } from '../context/BgmContext';
import { getMapDebugMode } from '../helpers/mapDebugMode';

const CHILD_STORAGE_KEY = 'selected_child_id';

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

function getStageLabel(worldProgress, world) {
  const stageCount = Number(world?.stageCount || world?.stages || 10);
  if (worldProgress?.cleared) return 'クリア';
  return `Stage ${worldProgress?.cleared_stage_count || 0} / ${stageCount}`;
}

export default function StudyMapPage() {
  const navigate = useNavigate();
  const { setBgmEnabled } = useBgm();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);
  const isMapDebugMode = getMapDebugMode();
  const [homeData, setHomeData] = useState(null);
  const [error, setError] = useState('');
  const [failedImages, setFailedImages] = useState(() => new Set());
  const [showBgmPrompt, setShowBgmPrompt] = useState(() => {
    try {
      return localStorage.getItem(BGM_PROMPT_SEEN_STORAGE_KEY) !== 'true';
    } catch (err) {
      return true;
    }
  });

  function answerBgmPrompt(enabled) {
    try {
      localStorage.setItem(BGM_PROMPT_SEEN_STORAGE_KEY, 'true');
    } catch (err) {
      // The preference still works for this session when storage is unavailable.
    }
    setShowBgmPrompt(false);
    setBgmEnabled(enabled);
  }

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
  const progressWorlds = questProgress.worlds || [];
  const currentWorldId = questProgress.mainline_complete ? 'shadow' : (questProgress.current_world || 'wind');

  const worlds = eigoQuestWorlds.map((world) => {
    const worldProgress = progressWorlds.find((item) => item.id === world.id) || {};
    const display = WORLD_DISPLAY[world.id] || {
      nameJa: world.nameJa,
      nameEn: `${world.id.toUpperCase()} REALM`,
      symbol: world.icon || '*',
      color: world.themeColor || '#45d7ff',
    };
    const stageCount = Number(worldProgress.stage_count || world.stageCount || world.stages || 10);
    const clearedStages = Number(worldProgress.cleared_stage_count || 0);
    const isComplete = Boolean(worldProgress.cleared);
    const isCurrent = world.id === currentWorldId && !questProgress.mainline_complete;
    const isFuture = !isMapDebugMode && !worldProgress.unlocked && !isCurrent;

    return {
      ...world,
      ...display,
      stageCount,
      stages: stageCount,
      wordCount: Number(worldProgress.word_count || stageCount * 20),
      progressWords: clearedStages * 20,
      progressPercent: Math.round((clearedStages / stageCount) * 100),
      stageLabel: getStageLabel(worldProgress, world),
      status: isComplete ? 'complete' : isCurrent ? 'current' : isFuture ? 'future' : 'active',
      unlocked: isMapDebugMode || Boolean(worldProgress.unlocked),
    };
  });

  const currentWorld = worlds.find((world) => world.id === currentWorldId) || worlds[0];

  function handleImageError(worldId) {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(worldId);
      return next;
    });
  }

  function handleWorldClick(world) {
    if (!isMapDebugMode && !world.unlocked && world.status === 'future') return;
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
            questProgress.mainline_complete ? 'メインクエストをクリアしました' : '学習の旅を確認しよう',
            'Stage clear で次の道が開くよ',
            'クリアしたStageはいつでも入り直せます',
          ]}
          variant={currentWorld?.id || 'wind'}
          action={<BgmToggle />}
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

      {showBgmPrompt ? (
        <div className="eq-bgm-prompt" role="dialog" aria-modal="true" aria-labelledby="bgm-prompt-title">
          <section className="eq-bgm-prompt__card">
            <span className="eq-bgm-prompt__icon" aria-hidden="true">♫</span>
            <h2 id="bgm-prompt-title">BGMを流しますか？</h2>
            <p>冒険の音楽をオンにすると、楽しく学習できます。</p>
            <div className="eq-bgm-prompt__actions">
              <button type="button" className="is-later" onClick={() => answerBgmPrompt(false)}>あとで</button>
              <button type="button" className="is-enable" onClick={() => answerBgmPrompt(true)}>オンにする</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
