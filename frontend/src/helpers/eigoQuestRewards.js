import eigoQuestCards from '../config/eigoQuestCards';

export const EIGO_QUEST_PENDING_REWARD_KEY = 'eigo_quest_pending_reward';

export const normalizeBoolean = (value) => (
  value === true
  || value === 1
  || value === '1'
  || String(value).toLowerCase() === 'true'
);

function normalizeReward(reward) {
  if (!reward || typeof reward !== 'object') return null;
  const code = reward.code || reward.heroCode || reward.hero_code || '';
  const heroId = reward.heroId ?? reward.hero_id ?? reward.cardId ?? reward.card_id ?? null;
  const cardId = reward.cardId || reward.card_id || code || reward.id || heroId || '';
  const imageUrl = reward.imageUrl
    || reward.image_url
    || reward.cardImage
    || reward.card_image
    || reward.image
    || '';
  const heroCode = reward.heroCode || reward.hero_code || code || '';
  if (!heroId && !cardId && !code && !heroCode && !imageUrl) return null;
  return {
    ...reward,
    cardId: String(cardId),
    heroId: heroId == null ? '' : String(heroId),
    hero_id: heroId == null ? '' : String(heroId),
    code: String(code || heroCode || cardId),
    heroCode: String(heroCode || code || cardId),
    hero_code: String(heroCode || code || cardId),
    imageUrl: String(imageUrl),
    image_url: String(imageUrl),
    cardImage: String(reward.cardImage || reward.card_image || imageUrl),
    card_image: String(reward.card_image || reward.cardImage || imageUrl),
    name: reward.name || reward.nameJa || reward.name_ja || '',
    nameJa: reward.nameJa || reward.name_ja || reward.name || '',
    name_ja: reward.name_ja || reward.nameJa || reward.name || '',
    lessonId: reward.lessonId || reward.lesson_id || '',
    lesson_id: reward.lesson_id || reward.lessonId || '',
    rewardType: reward.rewardType || reward.reward_type || '',
    reward_type: reward.reward_type || reward.rewardType || '',
    collectionType: reward.collectionType || reward.collection_type || '',
    collection_type: reward.collection_type || reward.collectionType || '',
    worldId: reward.worldId || reward.world_id || '',
    world_id: reward.world_id || reward.worldId || '',
    alreadyOwned: normalizeBoolean(reward.alreadyOwned ?? reward.already_owned),
    already_owned: normalizeBoolean(reward.alreadyOwned ?? reward.already_owned),
    raw: reward.raw || reward,
  };
}

function getRewardIdentity(reward) {
  if (!reward) return null;
  if (reward.heroId) return `hero-id:${reward.heroId}`;
  if (reward.cardId) return `card-id:${reward.cardId}`;
  if (reward.heroCode) return `hero-code:${reward.heroCode}`;
  if (reward.code) return `code:${reward.code}`;
  if (reward.lessonId) return `lesson:${reward.lessonId}`;
  if (reward.imageUrl) return `image:${reward.imageUrl}`;
  return null;
}

function getRewardCompletenessScore(reward) {
  if (!reward) return 0;
  return [
    reward.imageUrl,
    reward.heroId,
    reward.heroCode || reward.code,
    reward.name || reward.nameJa,
    reward.collectionType,
    reward.lessonId,
  ].filter(Boolean).length;
}

export function mergeRewardQueues(...queues) {
  const rewards = queues.flatMap((queue) => {
    if (!queue) return [];
    return Array.isArray(queue) ? queue : [queue];
  }).map(normalizeReward).filter(Boolean);

  const merged = new Map();
  rewards.forEach((reward) => {
    const key = getRewardIdentity(reward);
    if (!key) return;
    const existing = merged.get(key);
    if (!existing || getRewardCompletenessScore(reward) >= getRewardCompletenessScore(existing)) {
      merged.set(key, reward);
    }
  });

  return Array.from(merged.values());
}

export function getPendingRewardQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EIGO_QUEST_PENDING_REWARD_KEY) || 'null');
    const rewards = Array.isArray(parsed) ? parsed : parsed?.queue || parsed?.rewards || (parsed ? [parsed] : []);
    return mergeRewardQueues(rewards);
  } catch {
    return [];
  }
}

export function savePendingRewardQueue(rewards) {
  const queue = mergeRewardQueues(rewards || []);
  if (!queue.length) {
    localStorage.removeItem(EIGO_QUEST_PENDING_REWARD_KEY);
    return [];
  }
  localStorage.setItem(EIGO_QUEST_PENDING_REWARD_KEY, JSON.stringify(queue));
  return queue;
}

export function clearPendingReward() {
  localStorage.removeItem(EIGO_QUEST_PENDING_REWARD_KEY);
}

export function getPendingReward() {
  return getPendingRewardQueue()[0] || null;
}

export function savePendingReward(reward) {
  return savePendingRewardQueue(reward ? [reward] : []);
}

export function getCardById(cardId) {
  return eigoQuestCards.find((card) => card.id === cardId || card.code === cardId) || null;
}
