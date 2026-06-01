import eigoQuestCards from '../config/eigoQuestCards';

export const EIGO_QUEST_PENDING_REWARD_KEY = 'eigo_quest_pending_reward';

function normalizeReward(reward) {
  if (!reward || typeof reward !== 'object') return null;
  const cardId = reward.cardId || reward.card_id || reward.id || reward.code || '';
  if (!cardId) return null;
  return {
    ...reward,
    cardId: String(cardId),
    code: String(reward.code || cardId),
    worldId: reward.worldId || reward.world_id || '',
  };
}

export function getPendingRewardQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EIGO_QUEST_PENDING_REWARD_KEY) || 'null');
    const rewards = Array.isArray(parsed) ? parsed : parsed?.queue || parsed?.rewards || (parsed ? [parsed] : []);
    return rewards.map(normalizeReward).filter(Boolean);
  } catch {
    return [];
  }
}

export function savePendingRewardQueue(rewards) {
  const queue = (rewards || []).map(normalizeReward).filter(Boolean);
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
