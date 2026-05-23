import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EQBottomNav, EQCard, EQMobileShell } from '../components/eigo';
import eigoQuestWorlds from '../config/eigoQuestWorlds';

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

export default function WorldHomePage() {
  const navigate = useNavigate();
  const { worldId } = useParams();

  const world = useMemo(() => {
    const configWorld = eigoQuestWorlds.find((item) => item.id === worldId);
    const display = WORLD_DISPLAY[worldId] || {};

    return {
      ...configWorld,
      ...display,
      id: worldId,
      nameJa: display.nameJa || configWorld?.nameJa || '未知の世界',
      nameEn: display.nameEn || `${String(worldId || '').toUpperCase()} REALM`,
      symbol: display.symbol || configWorld?.icon || '★',
      color: display.color || configWorld?.themeColor || '#45d7ff',
    };
  }, [worldId]);

  return (
    <div className="eq-world-home-wrap">
      <EQMobileShell className="eq-world-home-screen">
        <header className="eq-world-home-header" style={{ '--world-color': world.color }}>
          <button type="button" onClick={() => navigate('/study-map')}>
            ← マップへ
          </button>

          <div className="eq-world-home-symbol">{world.symbol}</div>

          <div>
            <h1>{world.nameJa}</h1>
            <p>{world.nameEn}</p>
          </div>
        </header>

        <EQCard className="eq-world-home-card">
          <h2>この世界のミッション</h2>
          <p>
            英単語を集めて、この世界に閉じ込められた英雄を助けよう。
            今日の学習をクリアすると、世界の力が少しずつ戻ってくるよ。
          </p>

          <button type="button" onClick={() => navigate('/daily-words')}>
            今日のミッションを始める
          </button>
        </EQCard>

        <EQCard className="eq-world-home-card">
          <h2>ステージ</h2>
          <div className="eq-world-stage-list">
            {Array.from({ length: 10 }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => navigate(`/worlds/${world.id}/stages/${index + 1}`)}
              >
                Stage {index + 1}
              </button>
            ))}
          </div>
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