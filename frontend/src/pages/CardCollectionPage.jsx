import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomeData } from '../api';
import { EQBackPill, EQBottomNav, EQCard, EQMobileShell } from '../components/eigo';
import eigoQuestCards from '../config/eigoQuestCards';
import eigoQuestWorlds from '../config/eigoQuestWorlds';

const CHILD_STORAGE_KEY = 'selected_child_id';
const WORDS_PER_WORLD = 200;
const WORDS_PER_STAGE = 20;
const STAGES_PER_WORLD = 10;

const WORLD_META = {
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

const CARD_FILTERS = ['all', 'wind', 'fire', 'thunder', 'wood', 'rock', 'shadow', 'water', 'light'];

const WORD_REVIEW_MODES = new Set([
  'antonym',
  'audioQuiz',
  'cloze',
  'dailyReview',
  'example',
  'flashcard',
  'listening',
  'mixed',
  'multipleChoice',
  'sentence',
  'speedQuiz',
  'synonym',
  'timedReview',
  'vocabExpansion',
  'weakness',
  'wrongWords',
]);

function getWorldMeta(worldId) {
  return WORLD_META[worldId] || WORLD_META.wind;
}

function getImageCandidates(card) {
  const candidates = [];
  const image = card?.image || '';
  const fileName = image.split('/').pop();
  const worldFolder = card?.worldId;
  const number = fileName?.match(/(\d+)\.png$/)?.[1];

  if (image) candidates.push(image);
  if (worldFolder && fileName) candidates.push(`/assets/eigo-quest/cards/${worldFolder}/${fileName}`);
  if (worldFolder && number) candidates.push(`/assets/eigo-quest/cards/${worldFolder}/${card.worldId}-guardian${number}.png`);

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getCoverImageCandidates(card) {
  if (!card?.worldId) return [];
  return [`/assets/eigo-quest/cards/${card.worldId}/${card.worldId}-cover.png`];
}

function getCardReviewPath(card) {
  if (!card?.owned) return '/review';
  if (!WORD_REVIEW_MODES.has(card.reviewMode)) return '/review';

  const params = new URLSearchParams({
    worldId: card.worldId,
    cardId: card.id,
    reviewMode: card.reviewMode,
  });
  return `/review?${params.toString()}`;
}

function getLearnedWordsFromHomeData(homeData) {
  const learnedWords = Number(homeData?.mastered_words ?? homeData?.learned_words ?? homeData?.progress ?? 0);
  return Number.isFinite(learnedWords) ? Math.max(0, learnedWords) : 0;
}

function getProgressOwnedCardIds(learnedWordsCount) {
  const learnedWords = Math.max(0, Number(learnedWordsCount) || 0);
  const ownedIds = [];

  eigoQuestWorlds.forEach((world, worldIndex) => {
    const worldWords = Math.max(0, Math.min(WORDS_PER_WORLD, learnedWords - worldIndex * WORDS_PER_WORLD));
    const clearedStages = Math.max(0, Math.min(STAGES_PER_WORLD, Math.floor(worldWords / WORDS_PER_STAGE)));
    if (clearedStages <= 0) return;

    const worldCards = eigoQuestCards.filter((card) => card.worldId === world.id);
    worldCards.slice(0, clearedStages).forEach((card) => ownedIds.push(card.id));
  });

  return ownedIds;
}

function CardImage({ card, large = false }) {
  const [index, setIndex] = useState(0);
  const candidates = useMemo(
    () => (card.owned ? getImageCandidates(card) : getCoverImageCandidates(card)),
    [card],
  );
  const world = getWorldMeta(card.worldId);
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
          onError={() => setIndex((current) => current + 1)}
        />
      ) : (
        <span className="eq-card-art-symbol">{world.symbol}</span>
      )}
      {!card.owned ? <span className="eq-card-lock-mark">???</span> : null}
    </div>
  );
}

export default function CardCollectionPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [detailCard, setDetailCard] = useState(null);
  const [homeData, setHomeData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);

  useEffect(() => {
    if (!childId) {
      navigate('/select-child', { replace: true });
      return;
    }

    getHomeData(childId)
      .then((payload) => {
        setHomeData(payload);
        setError('');
      })
      .catch((err) => {
        setHomeData({ mastered_words: 0 });
        setError(err.message || 'カードの進捗データを読み込めませんでした。');
      });
  }, [childId, navigate]);

  const learnedWordsCount = getLearnedWordsFromHomeData(homeData);
  const ownedCardIds = useMemo(() => {
    return new Set(getProgressOwnedCardIds(learnedWordsCount));
  }, [learnedWordsCount]);
  const cards = useMemo(
    () => eigoQuestCards.map((card) => ({ ...card, owned: ownedCardIds.has(card.id) })),
    [ownedCardIds],
  );
  const visibleCards = useMemo(
    () => cards.filter((card) => activeFilter === 'all' || card.worldId === activeFilter),
    [activeFilter, cards],
  );
  const ownedCount = cards.filter((card) => card.owned).length;
  const selectedWorld = getWorldMeta(activeFilter);

  return (
    <div className="eq-card-page-wrap">
      <EQMobileShell className="eq-card-collection-screen">
        <EQBackPill to="/app">← ホームに戻る</EQBackPill>

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
            const world = getWorldMeta(card.worldId);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setDetailCard(card)}
                className={`eq-collection-card is-${card.worldId} ${card.owned ? 'is-owned' : 'is-locked'}`}
                style={{ '--world-color': world.color }}
              >
                <span className={`eq-rarity-badge rarity-${card.rarity}`}>{card.rarity}</span>
                <CardImage card={card} />
                <strong>{card.owned ? card.nameJa : '???'}</strong>
                <span>{world.name}</span>
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
            <CardImage card={detailCard} large />
            <div className="eq-card-detail-body">
              <span className={`eq-rarity-badge rarity-${detailCard.rarity}`}>{detailCard.rarity}</span>
              <h2>{detailCard.owned ? detailCard.nameJa : '???'}</h2>
              <p className="eq-card-world">ワールド: {getWorldMeta(detailCard.worldId).name}</p>
              <p>
                {detailCard.owned
                  ? detailCard.descriptionJa
                  : 'まだ手に入れていないカードです。クエストを進めて解放しよう。'}
              </p>
              <div className="eq-card-detail-meta">
                <span>Type: {detailCard.type}</span>
                <span>Review: {detailCard.reviewMode}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate(getCardReviewPath(detailCard))}
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
