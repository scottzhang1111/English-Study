import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EQBackPill, EQBottomNav, EQCard, EQMobileShell } from '../components/eigo';
import eigoQuestCards from '../config/eigoQuestCards';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import { getOwnedCardIds } from '../helpers/eigoQuestRewards';

const CARD_FILTERS = ['すべて', '風', '火', '雷', '木', '岩', '影', '水', '光'];

const WORLD_CLASS_BY_ID = {
  wind: '風',
  fire: '火',
  thunder: '雷',
  wood: '木',
  rock: '岩',
  shadow: '影',
  water: '水',
  light: '光',
};

function getWorld(card) {
  return eigoQuestWorlds.find((world) => world.id === card.worldId) || null;
}

function getWorldClass(card) {
  return WORLD_CLASS_BY_ID[card.worldId] || getWorld(card)?.icon || '風';
}

function CardArt({ card, large = false }) {
  const worldClass = getWorldClass(card);
  return (
    <div className={`eq-card-art eq-card-world-${worldClass} ${large ? 'is-large' : ''} ${card.owned ? '' : 'is-locked'}`}>
      <div className="eq-card-art-symbol">{card.owned ? worldClass : '?'}</div>
    </div>
  );
}

export default function CardCollectionPage() {
  const [activeFilter, setActiveFilter] = useState('すべて');
  const [detailCard, setDetailCard] = useState(null);
  const navigate = useNavigate();
  const ownedCardIds = useMemo(() => new Set(getOwnedCardIds()), []);
  const cards = useMemo(
    () => eigoQuestCards.map((card) => ({ ...card, owned: ownedCardIds.has(card.id) })),
    [ownedCardIds],
  );
  const visibleCards = useMemo(
    () => cards.filter((card) => activeFilter === 'すべて' || getWorldClass(card) === activeFilter),
    [activeFilter, cards],
  );

  return (
    <div className="eq-card-page-wrap">
      <EQMobileShell className="eq-card-collection-screen">
        <EQBackPill to="/app">← ホームに戻る</EQBackPill>

        <header className="eq-card-page-header">
          <h1 className="eq-page-title">カードコレクション</h1>
          <p className="eq-caption">集めたカードで復習クエストへ進もう</p>
        </header>

        <div className="eq-card-filter-tabs" role="tablist" aria-label="カード属性">
          {CARD_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={activeFilter === filter ? 'is-active' : ''}
            >
              {filter}
            </button>
          ))}
        </div>

        <section className="eq-card-grid" aria-label="カード一覧">
          {visibleCards.map((card) => {
            const world = getWorld(card);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setDetailCard(card)}
                className={`eq-collection-card ${card.owned ? 'is-owned' : 'is-locked'}`}
              >
                <span className={`eq-rarity-badge rarity-${card.rarity}`}>{card.rarity}</span>
                <CardArt card={card} />
                <strong>{card.owned ? card.nameJa : '???'}</strong>
                <span>{world?.nameJa || 'ワールド'}のカード</span>
              </button>
            );
          })}
        </section>
      </EQMobileShell>

      <EQBottomNav
        items={[
          { label: 'ホーム', to: '/app', icon: 'home' },
          { label: '地図', to: '/study-map', icon: 'map' },
          { label: '学習', to: '/daily-words', icon: 'study' },
          { label: 'カード', to: '/cards', icon: 'cards', active: true },
          { label: 'その他', to: '/settings', icon: 'more' },
        ]}
      />

      {detailCard && (
        <div className="eq-card-detail-overlay" onClick={() => setDetailCard(null)}>
          <EQCard className="eq-card-detail" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setDetailCard(null)} className="eq-card-detail-close">
              閉じる
            </button>
            <CardArt card={detailCard} large />
            <div className="eq-card-detail-body">
              <span className={`eq-rarity-badge rarity-${detailCard.rarity}`}>{detailCard.rarity}</span>
              <h2>{detailCard.owned ? detailCard.nameJa : '???'}</h2>
              <p className="eq-card-world">ワールド: {getWorld(detailCard)?.nameJa || detailCard.worldId}</p>
              <p>{detailCard.owned ? detailCard.descriptionJa : 'まだ手に入れていないカードです。クエストを進めて解放しよう。'}</p>
              <button
                type="button"
                onClick={() => navigate('/review')}
                disabled={!detailCard.owned}
                className="eq-gold-button"
              >
                このカードで復習する
              </button>
            </div>
          </EQCard>
        </div>
      )}
    </div>
  );
}
