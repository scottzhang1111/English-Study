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
  const code = reward.code || reward.heroCode || reward.hero_code || reward.cardCode || reward.card_code || '';
  const heroId = reward.heroId ?? reward.hero_id ?? null;
  const cardId = reward.cardId || reward.card_id || reward.id || code || heroId || '';
  const imageUrl = reward.imageUrl
    || reward.image_url
    || reward.cardImage
    || reward.card_image
    || reward.image
    || reward.assetPath
    || reward.asset_path
    || '';
  const heroCode = reward.heroCode || reward.hero_code || reward.cardCode || reward.card_code || code || '';
  const lessonId = reward.lessonId || reward.lesson_id || '';
  if (!heroId && !cardId && !code && !heroCode && !imageUrl && !lessonId) return null;
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
    lessonId,
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
  return getRewardIdentityTokens(reward)[0] || null;
}

function getRewardIdentityTokens(reward) {
  if (!reward) return [];
  return [
    reward.heroId ? `hero-id:${reward.heroId}` : '',
    reward.cardId ? `card-id:${reward.cardId}` : '',
    reward.heroCode ? `hero-code:${reward.heroCode}` : '',
    reward.code ? `code:${reward.code}` : '',
    reward.lessonId ? `lesson:${reward.lessonId}` : '',
    reward.imageUrl ? `image:${reward.imageUrl}` : '',
  ].filter(Boolean);
}

function getRewardCompletenessScore(reward) {
  if (!reward) return 0;
  let score = 0;
  if (reward.heroId) score += 8;
  if (reward.cardId) score += 5;
  if (reward.heroCode) score += 8;
  if (reward.code) score += 5;
  if (reward.imageUrl) score += 10;
  if (reward.name || reward.nameJa) score += 2;
  if (reward.collectionType) score += 2;
  if (reward.lessonId) score += 1;
  return score;
}

function mergeReward(existingReward, nextReward) {
  return {
    ...existingReward,
    ...nextReward,
    cardId: nextReward.cardId || existingReward.cardId,
    card_id: nextReward.card_id || existingReward.card_id,
    heroId: nextReward.heroId || existingReward.heroId,
    hero_id: nextReward.hero_id || existingReward.hero_id,
    heroCode: nextReward.heroCode || existingReward.heroCode,
    hero_code: nextReward.hero_code || existingReward.hero_code,
    code: nextReward.code || existingReward.code,
    imageUrl: nextReward.imageUrl || existingReward.imageUrl,
    image_url: nextReward.image_url || existingReward.image_url,
    cardImage: nextReward.cardImage || existingReward.cardImage,
    card_image: nextReward.card_image || existingReward.card_image,
    name: nextReward.name || existingReward.name,
    nameJa: nextReward.nameJa || existingReward.nameJa,
    name_ja: nextReward.name_ja || existingReward.name_ja,
    collectionType: nextReward.collectionType || existingReward.collectionType,
    collection_type: nextReward.collection_type || existingReward.collection_type,
    lessonId: nextReward.lessonId || existingReward.lessonId,
    lesson_id: nextReward.lesson_id || existingReward.lesson_id,
    alreadyOwned: Boolean(existingReward.alreadyOwned || nextReward.alreadyOwned),
    already_owned: Boolean(existingReward.already_owned || nextReward.already_owned),
  };
}

export function mergeRewardQueues(...queues) {
  const rewards = queues.flatMap((queue) => {
    if (!queue) return [];
    return Array.isArray(queue) ? queue : [queue];
  }).map(normalizeReward).filter(Boolean);

  const merged = new Map();
  rewards.forEach((reward) => {
    const tokens = getRewardIdentityTokens(reward);
    const existingEntry = Array.from(merged.entries()).find(([, existingReward]) => {
      const existingTokens = new Set(getRewardIdentityTokens(existingReward));
      return tokens.some((token) => existingTokens.has(token));
    });
    const key = existingEntry?.[0] || getRewardIdentity(reward);
    if (!key) return;
    const existing = existingEntry?.[1] || merged.get(key);
    if (!existing) {
      merged.set(key, reward);
      return;
    }
    const nextReward = getRewardCompletenessScore(reward) >= getRewardCompletenessScore(existing)
      ? mergeReward(existing, reward)
      : mergeReward(reward, existing);
    if (existingEntry && existingEntry[0] !== key) merged.delete(existingEntry[0]);
    merged.set(key, nextReward);
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
