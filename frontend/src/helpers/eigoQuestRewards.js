import eigoQuestCards from '../config/eigoQuestCards';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import { getEigoQuestProgress } from './eigoQuestProgress';

export const EIGO_QUEST_OWNED_CARD_IDS_KEY = 'eigo_quest_owned_card_ids';
export const EIGO_QUEST_PENDING_REWARD_KEY = 'eigo_quest_pending_reward';

export function getOwnedCardIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EIGO_QUEST_OWNED_CARD_IDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export function saveOwnedCardIds(cardIds) {
  const uniqueIds = Array.from(new Set((cardIds || []).filter(Boolean).map(String)));
  localStorage.setItem(EIGO_QUEST_OWNED_CARD_IDS_KEY, JSON.stringify(uniqueIds));
  return uniqueIds;
}

export function addOwnedCardId(cardId) {
  if (!cardId) return getOwnedCardIds();
  return saveOwnedCardIds([...getOwnedCardIds(), cardId]);
}

export function getPendingReward() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EIGO_QUEST_PENDING_REWARD_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function savePendingReward(reward) {
  if (!reward) {
    localStorage.removeItem(EIGO_QUEST_PENDING_REWARD_KEY);
    return null;
  }
  localStorage.setItem(EIGO_QUEST_PENDING_REWARD_KEY, JSON.stringify(reward));
  return reward;
}

export function clearPendingReward() {
  localStorage.removeItem(EIGO_QUEST_PENDING_REWARD_KEY);
}

export function pickRewardCardForProgress(learnedWordsCount = 0) {
  const progress = getEigoQuestProgress(learnedWordsCount, eigoQuestWorlds);
  const ownedIds = new Set(getOwnedCardIds());
  const worldCards = eigoQuestCards.filter((card) => card.worldId === progress.currentWorld.id);
  return worldCards.find((card) => !ownedIds.has(card.id)) || worldCards[0] || eigoQuestCards[0];
}

export function createMissionReward({ learnedWordsCount = 0, childId = '' } = {}) {
  const progress = getEigoQuestProgress(learnedWordsCount, eigoQuestWorlds);
  const card = pickRewardCardForProgress(learnedWordsCount);
  const reward = {
    id: `mission-${childId || 'child'}-${new Date().toISOString().slice(0, 10)}`,
    childId,
    exp: 50,
    coin: 30,
    cardId: card?.id || '',
    worldId: progress.currentWorld.id,
    createdAt: new Date().toISOString(),
  };
  return savePendingReward(reward);
}

export function getCardById(cardId) {
  return eigoQuestCards.find((card) => card.id === cardId) || null;
}
