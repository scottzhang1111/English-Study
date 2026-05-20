const EIGO_QUEST_ASSET_BASE = '/assets/eigo-quest';

export const eigoQuestAppAssets = {
  logoMark: `${EIGO_QUEST_ASSET_BASE}/app/logo-mark.png`,
  appIcon192: `${EIGO_QUEST_ASSET_BASE}/app/app-icon-192.png`,
  appIcon512: `${EIGO_QUEST_ASSET_BASE}/app/app-icon-512.png`,
};

export const eigoQuestIconAssets = {
  home: `${EIGO_QUEST_ASSET_BASE}/icons/icon-home.png`,
  map: `${EIGO_QUEST_ASSET_BASE}/icons/icon-map.png`,
  study: `${EIGO_QUEST_ASSET_BASE}/icons/icon-study.png`,
  cards: `${EIGO_QUEST_ASSET_BASE}/icons/icon-card.png`,
  card: `${EIGO_QUEST_ASSET_BASE}/icons/icon-card.png`,
  more: `${EIGO_QUEST_ASSET_BASE}/icons/icon-more.png`,
  word: `${EIGO_QUEST_ASSET_BASE}/icons/icon-word.png`,
  quiz: `${EIGO_QUEST_ASSET_BASE}/icons/icon-quiz.png`,
  grammar: `${EIGO_QUEST_ASSET_BASE}/icons/icon-grammar.png`,
  review: `${EIGO_QUEST_ASSET_BASE}/icons/icon-review.png`,
};

export function getEigoQuestIcon(iconKey) {
  return eigoQuestIconAssets[iconKey] || '';
}

export default {
  app: eigoQuestAppAssets,
  icons: eigoQuestIconAssets,
};
