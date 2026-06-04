import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChildHeroCards } from '../api';
import { EQBackPill, EQBottomNav, EQCard, EQMobileShell } from '../components/eigo';
import eigoQuestCards from '../config/eigoQuestCards';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

const CHILD_STORAGE_KEY = 'selected_child_id';

const WORLD_META = {
  grammar: { label: '文法', name: '文法の神殿', color: '#f3b64d', symbol: '文' },
  all: { label: 'すべて', name: 'すべて', color: '#ffd35a', symbol: '★' },
  wind: { label: '風', name: '風の世界', color: '#45d7ff', symbol: '風' },
  fire: { label: '火', name: '火の世界', color: '#ff6b3d', symbol: '火' },
  thunder: { label: '雷', name: '雷の世界', color: '#8b6bff', symbol: '雷' },
  wood: { label: '木', name: '木の世界', color: '#67d96b', symbol: '木' },
  rock: { label: '岩', name: '岩の世界', color: '#d7a85b', symbol: '岩' },
  shadow: { label: '影', name: '影の世界', color: '#a569ff', symbol: '影' },
  water: { label: '水', name: '水の世界', color: '#4ccfff', symbol: '水' },
  light: { label: '光', name: '光の世界', color: '#ffd86b', symbol: '光' },
};

const CARD_FILTERS = ['all', ...eigoQuestWorlds.map((world) => world.id), 'grammar'];

function getWorldMeta(worldId) {
  return WORLD_META[worldId] || WORLD_META.wind;
}

function getCardCollectionType(card) {
  return String(card?.collectionType || card?.collection_type || '').trim().toLowerCase();
}

function isGrammarCard(card) {
  return getCardCollectionType(card) === 'grammar';
}

function getCardWorldId(card) {
  return isGrammarCard(card) ? 'grammar' : card?.worldId;
}

function getCollectionMeta(cardOrWorldId) {
  if (typeof cardOrWorldId === 'string') return getWorldMeta(cardOrWorldId);
  return getWorldMeta(getCardWorldId(cardOrWorldId));
}

function withGrammarImageAliases(image) {
  if (!image) return [];
  return [
    image,
    image.replace('/grammar-cards/', '/grammar card/'),
    image.replace('/grammar card/', '/grammar-cards/'),
  ];
}

function getImageCandidates(card) {
  const candidates = [];
  const image = card?.image || '';
  if (isGrammarCard(card)) {
    return Array.from(new Set(withGrammarImageAliases(image).filter(Boolean)));
  }
  const fileName = image.split('/').pop();
  const worldFolder = card?.worldId;
  const number = fileName?.match(/(\d+)\.png$/)?.[1];

  if (worldFolder && fileName) candidates.push(`/assets/eigo-quest/cards/${worldFolder}/${fileName}`);
  if (worldFolder && number) candidates.push(`/assets/eigo-quest/cards/${worldFolder}/${card.worldId}-guardian${number}.png`);
  if (image) candidates.push(image);

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getCoverImageCandidates(card) {
  if (isGrammarCard(card)) return [];
  if (!card?.worldId) return [];
  return [
    `/assets/eigo-quest/cards/back/${card.worldId}-cover.png`,
    `/assets/eigo-quest/cards/${card.worldId}/${card.worldId}-cover.png`,
  ];
}

function normalizeHeroCard(card, index) {
  return {
    id: card.id || card.code || `hero-${index + 1}`,
    worldId: card.worldId || 'wind',
    nameJa: card.nameJa || card.name_ja || '',
    nameZh: card.nameZh || card.name_cn || '',
    type: card.type || 'hero',
    rarity: card.rarity || 'R',
    image: card.image || card.image_url || '',
    collectionType: card.collectionType || card.collection_type || '',
    collectionKey: card.collectionKey || card.collection_key || '',
    descriptionJa: card.descriptionJa || card.description_ja || '',
    unlockCondition: card.unlockCondition || '',
    reviewMode: card.reviewMode || 'mixed',
    owned: Boolean(card.owned),
  };
}

function CardImage({ card, large = false }) {
  const [index, setIndex] = useState(0);
  const candidates = useMemo(
    () => {
      if (!card?.owned) return getCoverImageCandidates(card);
      const images = getImageCandidates(card);
      return images.length ? images : getCoverImageCandidates(card);
    },
    [card],
  );
  const world = getCollectionMeta(card);
  const src = candidates[index];

  useEffect(() => {
    setIndex(0);
  }, [card?.id]);

  return (
    <div className={`eq-card-art ${large ? 'is-large' : ''} ${card.owned ? 'is-owned' : 'is-locked'}`}>
      {src ? (
        <img
          src={src}
          alt={card.owned ? card.nameJa : ''}
          loading="lazy"
          onError={() => {
            if (import.meta.env.DEV) {
              console.warn('Failed to load hero card image:', src, { card });
            }
            setIndex((current) => current + 1);
          }}
        />
      ) : (
        <span className="eq-card-art-symbol">{world.symbol}</span>
      )}
    </div>
  );
}

export default function CardCollectionPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [detailCard, setDetailCard] = useState(null);
  const [heroCards, setHeroCards] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }

    getChildHeroCards(childId)
      .then((payload) => {
        setHeroCards((payload.heroes || []).map(normalizeHeroCard));
        setError('');
      })
      .catch((err) => {
        setHeroCards(eigoQuestCards.map((card, index) => ({ ...normalizeHeroCard(card, index), owned: false })));
        setError(err.message || 'カードの進捗データを読み込めませんでした。');
      });
  }, [childId, navigate]);

  const cardSource = heroCards.length ? heroCards : eigoQuestCards;
  const cards = useMemo(
    () => cardSource.map((card, index) => normalizeHeroCard(card, index)),
    [cardSource],
  );
  const visibleCards = useMemo(
    () => cards.filter((card) => activeFilter === 'all' || getCardWorldId(card) === activeFilter),
    [activeFilter, cards],
  );
  const ownedCount = cards.filter((card) => card.owned).length;
  const selectedWorld = getWorldMeta(activeFilter);

  return (
    <div className="eq-card-page-wrap">
      <EQMobileShell className="eq-card-collection-screen">
        <EQBackPill to="/app">← ホームに戻る</EQBackPill>

        <CompactPageHeader
          title="カード一覧"
          subtitle="集めたカードを確認しよう"
          backgroundImage="/assets/eigo-quest/learning-hub/上の背景.png"
          elementLabel={selectedWorld.symbol}
          progressText={`${ownedCount} / ${cards.length}`}
          variant="cards"
        />

        <header className="eq-card-page-header">
          <div>
            <p>Card Collection</p>
            <h1 className="eq-page-title">カードコレクション</h1>
            <span>世界ごとのカードを集めて、復習クエストへ進もう</span>
          </div>
          <EQCard className="eq-card-collection-summary">
            <div>
              <span>所持カード</span>
              <strong>{ownedCount} / {cards.length}</strong>
            </div>
            <div>
              <span>表示中</span>
              <strong>{selectedWorld.name}</strong>
            </div>
          </EQCard>
        </header>

        {error ? <div className="eq-study-map-error">{error}</div> : null}

        <div className="eq-card-filter-tabs" role="tablist" aria-label="カード属性">
          {CARD_FILTERS.map((filter) => {
            const world = getWorldMeta(filter);
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={activeFilter === filter ? 'is-active' : ''}
                style={{ '--world-color': world.color }}
              >
                {world.label}
              </button>
            );
          })}
        </div>

        <section className="eq-card-grid" aria-label="カード一覧">
          {visibleCards.map((card) => {
            const world = getCollectionMeta(card);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  if (card.owned) setDetailCard(card);
                }}
                disabled={!card.owned}
                aria-disabled={!card.owned}
                className={`eq-collection-card is-${getCardWorldId(card)} ${card.owned ? 'is-owned' : 'is-locked'}`}
                style={{ '--world-color': world.color }}
              >
                <span className={`eq-rarity-badge rarity-${card.rarity}`}>{card.rarity}</span>
                <CardImage card={card} />
                <strong>{card.nameJa || '???'}</strong>
                <p className="eq-collection-card-description">
                  {card.descriptionJa || '英雄の物語はまだ記録されていません。'}
                </p>
                <span>{world.name}</span>
              </button>
            );
          })}
        </section>
      </EQMobileShell>

      <EQBottomNav
        items={[
          { label: 'ホーム', to: '/app', icon: 'home' },
          { label: '地図', to: '/app/study-map', icon: 'map' },
          { label: '学習', to: '/learning-hub', icon: 'study' },
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
            <CardImage card={detailCard} large />
            <div className="eq-card-detail-body">
              <span className={`eq-rarity-badge rarity-${detailCard.rarity}`}>{detailCard.rarity}</span>
              <h2>{detailCard.nameJa || '???'}</h2>
              <p className="eq-card-world">ワールド: {getCollectionMeta(detailCard).name}</p>
              <div className="eq-card-detail-story">
                <h3>英雄の詳細</h3>
                <p>
                  {detailCard.descriptionJa || '英雄の物語はまだ記録されていません。'}
                </p>
              </div>
              <div className="eq-card-detail-meta">
                <span>Type: {detailCard.type}</span>
                <span>Rarity: {detailCard.rarity}</span>
                {detailCard.nameZh ? <span>Name CN: {detailCard.nameZh}</span> : null}
              </div>
            </div>
          </EQCard>
        </div>
      )}
    </div>
  );
}
