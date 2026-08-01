import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getHeroCards } from '../api';
import { EQBottomNav, GoldQuestButton } from '../components/eigo';
import { getEigoQuestWorld } from '../config/eigoQuestWorlds';
import {
  clearPendingReward,
  getCardById,
  getPendingRewardQueue,
  normalizeBoolean,
  savePendingRewardQueue,
} from '../helpers/eigoQuestRewards';
import eigoQuestCards from '../config/eigoQuestCards';

const GRAMMAR_CARD_BACK_IMAGE = '/assets/eigo-quest/learning-hub/grammar card/grammar-cover.png';

const sparkleParticles = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  left: `${7 + ((index * 19) % 86)}%`,
  top: `${7 + ((index * 31) % 82)}%`,
  delay: (index % 7) * 0.14,
  size: 4 + (index % 5) * 2,
}));

function normalizeHeroCard(card, index = 0) {
  if (!card) return null;
  return {
    ...card,
    id: String(card.id || card.code || `hero-${index + 1}`),
    heroId: card.heroId || card.hero_id || '',
    heroCode: card.heroCode || card.hero_code || card.code || '',
    hero_code: card.hero_code || card.heroCode || card.code || '',
    code: String(card.code || card.id || ''),
    worldId: card.worldId || card.world_id || 'wind',
    nameJa: card.nameJa || card.name_ja || '',
    nameZh: card.nameZh || card.name_cn || '',
    sourceJa: card.sourceJa || card.source_ja || card.originJa || card.origin_ja || '',
    rarity: card.rarity || 'R',
    image: card.image || card.imageUrl || card.image_url || '',
    collectionType: card.collectionType || card.collection_type || '',
    collectionKey: card.collectionKey || card.collection_key || '',
    descriptionJa: card.descriptionJa || card.description_ja || '',
    unlockCondition: card.unlockCondition || card.unlock_condition || '',
  };
}

function getWorldClass(worldId) {
  const worldClassMap = {
    wind: '風',
    fire: '火',
    thunder: '雷',
    wood: '木',
    rock: '岩',
    shadow: '影',
    water: '水',
    light: '光',
  };
  return worldClassMap[worldId] || '風';
}

function getRewardCardImage(card) {
  if (!card?.image) return '';
  const image = card.image;
  if ((card.collectionType || card.collection_type) === 'boss_card') {
    return image;
  }
  if ((card.collectionType || card.collection_type) === 'grammar') {
    return image.replace('/grammar-cards/', '/grammar card/');
  }
  const worldId = card.worldId || 'wind';
  if (image.includes(`/cards/${worldId}/`)) return image;
  return image.replace('/assets/eigo-quest/cards/', `/assets/eigo-quest/cards/${worldId}/`);
}

function getPendingRewardImage(reward) {
  return reward?.image_url
    || reward?.imageUrl
    || reward?.card_image
    || reward?.cardImage
    || reward?.image
    || reward?.asset_path
    || reward?.assetPath
    || reward?.raw?.image_url
    || reward?.raw?.imageUrl
    || reward?.raw?.card_image
    || reward?.raw?.cardImage
    || reward?.raw?.image
    || reward?.raw?.asset_path
    || reward?.raw?.assetPath
    || '';
}

function getHeroImage(hero) {
  return hero?.image_url
    || hero?.imageUrl
    || hero?.card_image
    || hero?.cardImage
    || hero?.image
    || hero?.asset_path
    || hero?.assetPath
    || '';
}

function normalizeGrammarRewardImage(image) {
  return String(image || '').replace('/grammar-cards/', '/grammar card/');
}

const rewardBackWorldIds = new Set(['wind', 'fire', 'water', 'thunder', 'wood', 'rock', 'light', 'shadow']);

function getRewardCardBackImage(worldId, isGrammarReward = false) {
  if (isGrammarReward) return GRAMMAR_CARD_BACK_IMAGE;
  const normalized = String(worldId || 'wind').trim().toLowerCase();
  const safeWorldId = rewardBackWorldIds.has(normalized) ? normalized : 'wind';
  return `/assets/eigo-quest/cards/back/${safeWorldId}-cover.png`;
}

function getImageFileName(image = '') {
  return String(image).split('?')[0].split('/').pop() || '';
}

function findRewardHero(apiHeroes, pendingReward, fallbackCard) {
  const fallback = normalizeHeroCard(fallbackCard);
  const rewardIds = [
    pendingReward?.cardId,
    pendingReward?.card_id,
    pendingReward?.heroId,
    pendingReward?.hero_id,
    pendingReward?.raw?.cardId,
    pendingReward?.raw?.card_id,
    pendingReward?.raw?.heroId,
    pendingReward?.raw?.hero_id,
    fallback?.id,
    fallback?.heroId,
  ].filter((value) => value != null && value !== '').map(String);
  const rewardCodes = [
    pendingReward?.heroCode,
    pendingReward?.hero_code,
    pendingReward?.code,
    pendingReward?.raw?.heroCode,
    pendingReward?.raw?.hero_code,
    pendingReward?.raw?.code,
    fallback?.code,
    fallback?.heroCode,
    fallback?.hero_code,
  ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  const rewardWorldId = pendingReward?.worldId || pendingReward?.world_id || fallback?.worldId || '';
  const rewardImageName = getImageFileName(fallback?.image);
  const rewardNameSet = new Set([fallback?.nameJa, fallback?.nameZh].filter(Boolean));
  const matches = (card) => {
    const hero = normalizeHeroCard(card);
    if (!hero) return false;
    const heroIds = [
      hero.id,
      hero.heroId,
      hero.hero_id,
      hero.cardId,
      hero.card_id,
    ].filter((value) => value != null && value !== '').map(String);
    const heroCodes = [
      hero.code,
      hero.heroCode,
      hero.hero_code,
    ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
    if (rewardIds.some((id) => heroIds.includes(id))) return true;
    if (rewardCodes.some((code) => heroCodes.includes(code))) return true;

    const sameWorld = !rewardWorldId || hero.worldId === rewardWorldId;
    if (sameWorld && rewardImageName && getImageFileName(hero.image) === rewardImageName) return true;
    if (sameWorld && (rewardNameSet.has(hero.nameJa) || rewardNameSet.has(hero.nameZh))) return true;
    return false;
  };

  return normalizeHeroCard(apiHeroes.find(matches)) || fallback;
}

function parseStageNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function inferStageFromReward(pendingReward, rewardCard) {
  const directStage = parseStageNumber(
    pendingReward?.stage
    || pendingReward?.stageNumber
    || pendingReward?.stage_number
    || pendingReward?.awardedStageNumber
    || pendingReward?.awarded_stage_number
    || rewardCard?.stage
    || rewardCard?.stageNumber
    || rewardCard?.stage_number,
  );
  if (directStage) return directStage;

  const worldId = pendingReward?.worldId || pendingReward?.world_id || rewardCard?.worldId || '';
  const code = String(pendingReward?.code || pendingReward?.cardId || rewardCard?.code || rewardCard?.id || '');
  const codeMatch = code.match(/guardian(\d+)$/i);
  if (codeMatch) {
    const stage = Number(codeMatch[1]);
    return worldId === 'shadow' && stage > 5 ? 5 : stage;
  }

  const imageMatch = String(rewardCard?.image || '').match(/guardian(\d+)\.(?:png|webp|jpg|jpeg)$/i);
  if (imageMatch) {
    const stage = Number(imageMatch[1]);
    return worldId === 'shadow' && stage > 5 ? 5 : stage;
  }

  const conditionMatch = String(rewardCard?.unlockCondition || '').match(/Stage\s*(\d+)/i);
  if (conditionMatch) return Number(conditionMatch[1]);
  return null;
}

function getStageCompleteLabel(pendingReward, rewardCard, searchParams) {
  const routeWorldId = searchParams.get('world') || searchParams.get('world_id') || '';
  const routeStage = searchParams.get('stage') || searchParams.get('stage_number') || '';
  const worldId = routeWorldId || pendingReward?.worldId || pendingReward?.world_id || rewardCard?.worldId || '';
  const stage = parseStageNumber(routeStage) || inferStageFromReward(pendingReward, rewardCard);
  const world = getEigoQuestWorld(worldId);

  if (world?.nameJa && stage) return `${world.nameJa}・Stage ${stage} Complete`;
  if (stage) return `Stage ${stage} Complete`;
  return 'Stage Complete';
}

function getHeroCopy(card) {
  return {
    name: card?.nameJa || card?.nameZh || '新しい英雄',
    rarity: card?.rarity || 'R',
  };
}

function formatRewardRarity(rarity) {
  const value = String(rarity || '').trim();
  if (!value) return 'Rare';
  if (value.length <= 2) return value.toUpperCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isGrammarRewardSource(reward) {
  const source = [
    reward?.source,
    reward?.rewardSource,
    reward?.reward_source,
    reward?.rewardType,
    reward?.reward_type,
    reward?.type,
    reward?.category,
  ].filter(Boolean).join(' ').toLowerCase();
  return source.includes('grammar');
}

function isBossCardRewardSource(reward) {
  const source = [
    reward?.type,
    reward?.rewardType,
    reward?.reward_type,
    reward?.source,
    reward?.category,
    reward?.cardId,
    reward?.card_id,
  ].filter(Boolean).join(' ').toLowerCase();

  return (
    source.includes('boss_card')
    || source.includes('boss-card')
    || source.includes('boss_clear')
    || Boolean(reward?.bossId || reward?.boss_id)
  );
}

function getGrammarRewardCopy(reward, fallbackTitle) {
  const lessonTitle = reward?.lessonTitle || reward?.lesson_title || reward?.title || fallbackTitle || '文法';
  const correct = Number(reward?.correctCount ?? reward?.correct_count ?? reward?.score ?? reward?.correct ?? 0);
  const total = Number(reward?.totalCount ?? reward?.total_count ?? reward?.total ?? 0);
  const hasScore = Number.isFinite(correct) && correct > 0 && Number.isFinite(total) && total > 0;
  return {
    stageLabel: '文法テスト クリア',
    masteryText: `${lessonTitle}をマスター！`,
    scoreText: hasScore ? `${correct} / ${total}` : '',
    scoreLabel: hasScore ? '正解' : '',
    gainText: '新しい文法英雄カードを獲得しました！',
  };
}

function getBossRewardCopy() {
  return {
    stageLabel: 'Boss Battle Clear',
    masteryText: '風の試練を突破した証だよ！',
    scoreText: 'CLEAR',
    scoreLabel: 'Boss Defeated',
    gainText: 'Boss Cardを獲得しました！',
    cardTypeText: 'Boss Card',
  };
}

const grammarFadeDownVariant = {
  hidden: {
    opacity: 0,
    scale: 0.82,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: [0.82, 1.06, 1],
    y: 0,
  },
};

const grammarFadeUpVariant = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const grammarCardVariant = {
  hidden: {
    opacity: 0,
    y: 42,
    scale: 0.48,
  },
  visible: {
    opacity: 1,
    y: [42, -8, 3, 0],
    scale: [0.48, 1.1, 0.97, 1],
  },
};

const grammarChargeVariant = {
  hidden: {
    opacity: 0,
    scale: 0.1,
  },
  visible: {
    opacity: [0, 0.9, 0.65],
    scale: [0.1, 0.55, 0.8],
  },
};

const grammarSummonFlashVariant = {
  hidden: {
    opacity: 0,
    scale: 0.2,
  },
  visible: {
    opacity: [0, 1, 0],
    scale: [0.2, 1.35, 1.8],
  },
};

const grammarMagicCircleVariant = {
  hidden: {
    opacity: 0,
    scale: 0.55,
    rotate: -20,
  },
  visible: {
    opacity: [0, 0.95, 0.65],
    scale: [0.55, 1.16, 1],
    rotate: 0,
  },
};

const grammarLightRaysVariant = {
  hidden: {
    opacity: 0,
    scaleY: 0.25,
  },
  visible: {
    opacity: [0, 0.9, 0.5],
    scaleY: [0.25, 1.18, 1],
  },
};

export default function CardRewardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const [rewardStep, setRewardStep] = useState('reveal');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [grammarAnimationComplete, setGrammarAnimationComplete] = useState(false);
  const [grammarImageReady, setGrammarImageReady] = useState(false);
  const [grammarImageStatus, setGrammarImageStatus] = useState('loading');
  const [apiHeroes, setApiHeroes] = useState([]);
  const [heroesLoaded, setHeroesLoaded] = useState(false);
  const [pendingQueue, setPendingQueue] = useState(() => getPendingRewardQueue());
  const [rewardIndex, setRewardIndex] = useState(0);
  const isGrammarAdvancingRef = useRef(false);
  const pendingReward = pendingQueue[rewardIndex] || null;
  const fallbackCard = useMemo(() => eigoQuestCards[0], []);
  const isGrammarReward = isGrammarRewardSource(pendingReward);
  const isBossCardReward = isBossCardRewardSource(pendingReward);
  const bossRewardCard = isBossCardReward
    ? normalizeHeroCard({
      id: pendingReward.cardId,
      code: pendingReward.cardId,
      worldId: pendingReward.worldId || pendingReward.world_id || 'wind',
      nameJa: pendingReward.nameJa || pendingReward.name_ja || 'Boss Card',
      rarity: pendingReward.rarity || 'Rare',
      image: pendingReward.image,
      collectionType: 'boss_card',
      sourceJa: 'Boss Battle',
    })
    : null;
  const pendingRewardImage = normalizeGrammarRewardImage(getPendingRewardImage(pendingReward));
  const pendingRewardCard = pendingReward
    ? normalizeHeroCard({
      id: pendingReward.cardId || pendingReward.card_id || pendingReward.code || pendingReward.heroCode || pendingReward.hero_code || pendingReward.id,
      code: pendingReward.code || pendingReward.heroCode || pendingReward.hero_code || pendingReward.cardId || pendingReward.card_id || pendingReward.id,
      heroId: pendingReward.heroId || pendingReward.hero_id,
      heroCode: pendingReward.heroCode || pendingReward.hero_code || pendingReward.code,
      hero_code: pendingReward.hero_code || pendingReward.heroCode || pendingReward.code,
      worldId: pendingReward.worldId || pendingReward.world_id || (isGrammarReward ? 'grammar' : 'wind'),
      nameJa: pendingReward.nameJa || pendingReward.name_ja || pendingReward.name || '',
      nameZh: pendingReward.nameZh || pendingReward.name_cn || '',
      rarity: pendingReward.rarity || 'R',
      image: pendingRewardImage,
      collectionType: pendingReward.collectionType || pendingReward.collection_type || (isGrammarReward ? 'grammar' : ''),
      collectionKey: pendingReward.collectionKey || pendingReward.collection_key || '',
      descriptionJa: pendingReward.descriptionJa || pendingReward.description_ja || '',
    })
    : null;
  const apiRewardHero = pendingReward ? findRewardHero(apiHeroes, pendingReward, null) : null;
  const grammarRewardCard = isGrammarReward
    ? (pendingRewardImage ? pendingRewardCard : (apiRewardHero || pendingRewardCard))
    : null;
  const rewardCard = pendingReward
    ? (
      bossRewardCard
      || (isGrammarReward
        ? grammarRewardCard
        : findRewardHero(apiHeroes, pendingReward, getCardById(pendingReward?.cardId) || fallbackCard))
    )
    : null;
  const worldClass = getWorldClass(rewardCard?.worldId);
  const rewardImage = getRewardCardImage(rewardCard);
  const apiRewardImage = normalizeGrammarRewardImage(getHeroImage(apiRewardHero));
  const grammarRewardImage = pendingRewardImage || apiRewardImage || '';
  const grammarRewardKey = [
    pendingReward?.code,
    pendingReward?.hero_code,
    pendingReward?.heroCode,
    pendingReward?.hero_id,
    pendingReward?.heroId,
    pendingReward?.card_id,
    pendingReward?.cardId,
    grammarRewardImage,
  ].filter(Boolean).map(String)[0] || 'grammar-reward';
  const apiRewardHeroKey = [
    apiRewardHero?.id,
    apiRewardHero?.heroId,
    apiRewardHero?.code,
    apiRewardHero?.heroCode,
    apiRewardImage,
  ].filter(Boolean).map(String).join(':');
  const rewardBackImage = getRewardCardBackImage(
    pendingReward?.worldId || pendingReward?.world_id || rewardCard?.worldId,
    isGrammarReward,
  );
  const hero = getHeroCopy(rewardCard);
  const displayRarity = isBossCardReward ? formatRewardRarity(hero.rarity) : hero.rarity;
  const hasNextReward = rewardIndex < pendingQueue.length - 1;
  const grammarCopy = getGrammarRewardCopy(pendingReward, rewardCard?.nameJa);
  const bossCopy = getBossRewardCopy(pendingReward);
  const isAlreadyOwned = normalizeBoolean(pendingReward?.alreadyOwned ?? pendingReward?.already_owned);
  const stageCompleteLabel = isBossCardReward
    ? bossCopy.stageLabel
    : isGrammarReward
    ? grammarCopy.stageLabel
    : getStageCompleteLabel(pendingReward, rewardCard, searchParams);
  const masteryText = isBossCardReward ? bossCopy.masteryText : grammarCopy.masteryText;
  const scoreText = isBossCardReward ? bossCopy.scoreText : isGrammarReward ? (grammarCopy.scoreText || 'CLEAR') : '20 / 20';
  const scoreLabel = isBossCardReward ? bossCopy.scoreLabel : isGrammarReward ? (grammarCopy.scoreLabel || 'Grammar Mastered') : 'Words Mastered';
  const gainText = isBossCardReward ? bossCopy.gainText : isGrammarReward ? grammarCopy.gainText : '新しい英雄カードを獲得しました！';
  const rewardCardTypeText = isBossCardReward ? `${displayRarity} ${bossCopy.cardTypeText}` : `${hero.rarity} Hero`;
  const rewardPageClass = [
    'eq-card-page-wrap',
    'quest-reward-page-wrap',
    'quest-reward-palace',
    isGrammarReward ? 'eq-grammar-reward-page' : '',
    isBossCardReward ? 'eq-boss-reward-page' : '',
    `is-${rewardStep}`,
  ].filter(Boolean).join(' ');

  const rewardReturnTo = (() => {
    const target = pendingReward?.returnTo || pendingReward?.return_to || '';
    return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/app';
  })();

  const motionDuration = (duration) => (shouldReduceMotion ? 0.01 : duration);
  const canStartGrammarAnimation = !isGrammarReward || grammarImageStatus === 'ready';

  useEffect(() => {
    let cancelled = false;
    getHeroCards()
      .then((payload) => {
        if (!cancelled) setApiHeroes((payload.heroes || []).map(normalizeHeroCard).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setApiHeroes([]);
      })
      .finally(() => {
        if (!cancelled) setHeroesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isGrammarReward) return;
    setGrammarImageReady(false);
    setGrammarAnimationComplete(false);
    setGrammarImageStatus('loading');
    setIsAdvancing(false);
    isGrammarAdvancingRef.current = false;
  }, [isGrammarReward, grammarRewardKey]);

  useEffect(() => {
    if (!isGrammarReward) return undefined;
    setGrammarImageReady(false);
    setGrammarAnimationComplete(false);
    setGrammarImageStatus('loading');

    if (import.meta.env.DEV) {
      console.log('[GrammarReward] pendingReward', pendingReward);
      console.log('[GrammarReward] apiHeroes count', apiHeroes.length);
      console.log('[GrammarReward] apiRewardHero', apiRewardHero);
      console.log('[GrammarReward] grammarRewardImage', grammarRewardImage);
      console.log('[GrammarReward] grammarRewardKey', grammarRewardKey);
      console.log('[GrammarReward] alreadyOwned', isAlreadyOwned);
    }

    if (!heroesLoaded) return undefined;
    if (!grammarRewardImage) {
      setGrammarImageStatus('error');
      return undefined;
    }

    const image = new Image();
    image.onload = () => {
      setGrammarImageReady(true);
      setGrammarImageStatus('ready');
    };
    image.onerror = () => {
      setGrammarImageReady(false);
      setGrammarImageStatus('error');
      if (import.meta.env.DEV) {
        console.warn('Failed to preload grammar reward hero image:', grammarRewardImage, { pendingReward, apiRewardHero });
      }
    };
    image.src = grammarRewardImage;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [
    apiHeroes.length,
    apiRewardHeroKey,
    grammarRewardImage,
    grammarRewardKey,
    heroesLoaded,
    isAlreadyOwned,
    isGrammarReward,
    pendingReward,
  ]);

  const finishRewards = () => {
    clearPendingReward();
    navigate(rewardReturnTo);
  };

  const revealCard = () => {
    if (rewardStep !== 'reveal' || isAdvancing) return;
    setIsAdvancing(true);
    setIsFlipped(true);
    window.setTimeout(() => {
      setRewardStep('detail');
      setIsAdvancing(false);
    }, 760);
  };

  const showNextReward = () => {
    if (!hasNextReward) {
      finishRewards();
      return;
    }
    const nextIndex = rewardIndex + 1;
    savePendingRewardQueue(pendingQueue.slice(nextIndex));
    setPendingQueue((queue) => queue.slice(nextIndex));
    setRewardIndex(0);
    setRewardStep('reveal');
    setIsFlipped(false);
    setIsAdvancing(false);
    setGrammarImageReady(false);
    setGrammarAnimationComplete(false);
    isGrammarAdvancingRef.current = false;
  };

  const handleGrammarContinue = () => {
    if (!grammarAnimationComplete || isAdvancing || isGrammarAdvancingRef.current) return;
    isGrammarAdvancingRef.current = true;
    setIsAdvancing(true);

    if (hasNextReward) {
      showNextReward();
      return;
    }

    finishRewards();
  };

  if (!rewardCard) {
    return (
      <>
        <div className="eq-card-page-wrap quest-reward-page-wrap quest-reward-palace is-detail">
          <section className="quest-reward-empty" aria-label="報酬なし">
            <h1>CLEAR!</h1>
            <p>報酬は受け取り済みです。</p>
            <GoldQuestButton onClick={finishRewards} className="eq-reward-claim-button quest-reward-main-button">
              ホームへ
            </GoldQuestButton>
          </section>
        </div>
        <EQBottomNav className="eq-home-bottom-nav" />
      </>
    );
  }

  if (isGrammarReward && grammarImageStatus === 'error') {
    return (
      <>
        <div className={`${rewardPageClass} is-grammar-presentation`}>
          <section className="grammar-reward-hero grammar-reward-error">
            <div className="grammar-reward-clear-heading">
              <span className="grammar-reward-crown" aria-hidden="true" />
              <h1>CLEAR!</h1>
              <span className="grammar-reward-laurel" aria-hidden="true" />
            </div>
            <div className="grammar-reward-ribbon">文法テスト クリア</div>
            <p className="grammar-reward-mastery">カード情報を読み込めませんでした</p>
            <GoldQuestButton
              onClick={finishRewards}
              className="eq-reward-claim-button quest-reward-main-button grammar-reward-main-button"
              disabled={isAdvancing}
            >
              ホームへ
            </GoldQuestButton>
          </section>
        </div>
        <EQBottomNav className="eq-home-bottom-nav" />
      </>
    );
  }

  if (isGrammarReward) {
    return (
      <>
        <div className={`${rewardPageClass} is-grammar-presentation`}>
          <motion.section
            key={`grammar-reward-${grammarRewardKey}-${canStartGrammarAnimation ? 'ready' : 'loading'}`}
            className="grammar-reward-hero"
            aria-label="文法テストクリア"
            initial="hidden"
            animate={canStartGrammarAnimation ? 'visible' : 'hidden'}
          >
            <div className="grammar-reward-clear-heading">
              <motion.span
                className="grammar-reward-crown"
                aria-hidden="true"
                variants={grammarFadeUpVariant}
                transition={{ duration: motionDuration(0.35), delay: 0, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.h1
                variants={grammarFadeDownVariant}
                transition={{
                  duration: motionDuration(0.6),
                  delay: motionDuration(0.25),
                  times: [0, 0.72, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                CLEAR!
              </motion.h1>
              <motion.span
                className="grammar-reward-laurel"
                aria-hidden="true"
                variants={grammarFadeUpVariant}
                transition={{ duration: motionDuration(0.35), delay: 0, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>

            <motion.div
              className="grammar-reward-ribbon"
              initial={{
                opacity: 0,
                scaleX: 0.68,
              }}
              animate={{
                opacity: canStartGrammarAnimation ? 1 : 0,
                scaleX: canStartGrammarAnimation ? 1 : 0.68,
              }}
              transition={{ duration: motionDuration(0.46), delay: motionDuration(0.55), ease: [0.22, 1, 0.36, 1] }}
            >
              文法テスト クリア
            </motion.div>

            <motion.p
              className="grammar-reward-mastery"
              initial={{ opacity: 0, y: 10 }}
              animate={canStartGrammarAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: motionDuration(0.42), delay: motionDuration(0.72), ease: [0.22, 1, 0.36, 1] }}
            >
              {masteryText}
            </motion.p>

            <section className="grammar-reward-card-stage" aria-label="新しい文法英雄カード">
              <motion.div
                className="grammar-reward-stage-base"
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={canStartGrammarAnimation ? { opacity: 0.62 } : { opacity: 0 }}
                transition={{ duration: motionDuration(0.35), delay: 0, ease: [0.22, 1, 0.36, 1] }}
              />
              {grammarImageReady ? (
                <>
                  <motion.div
                    className="grammar-reward-light-rays"
                    aria-hidden="true"
                    variants={grammarLightRaysVariant}
                    transition={{
                      duration: motionDuration(0.86),
                      delay: motionDuration(1.12),
                      times: [0, 0.66, 1],
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                  <motion.div
                    className="grammar-reward-magic-circle"
                    aria-hidden="true"
                    variants={grammarMagicCircleVariant}
                    transition={{
                      duration: motionDuration(0.92),
                      delay: motionDuration(1.02),
                      times: [0, 0.72, 1],
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                  <motion.div
                    className="grammar-reward-card-glow"
                    aria-hidden="true"
                    variants={grammarChargeVariant}
                    transition={{
                      duration: motionDuration(0.42),
                      delay: motionDuration(0.9),
                      times: [0, 0.65, 1],
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                  <motion.div
                    className="grammar-reward-summon-flash"
                    aria-hidden="true"
                    variants={grammarSummonFlashVariant}
                    transition={{
                      duration: motionDuration(0.72),
                      delay: motionDuration(1.3),
                      times: [0, 0.36, 1],
                      ease: 'easeOut',
                    }}
                  />
                </>
              ) : null}

              <AnimatePresence mode="wait">
                {grammarRewardImage && grammarImageReady ? (
                  <motion.div
                    key={`grammar-card-${grammarRewardKey}`}
                    className="grammar-reward-card"
                    variants={grammarCardVariant}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: 18, scale: 0.96 }}
                    transition={{
                      duration: motionDuration(0.88),
                      delay: motionDuration(1.15),
                      ease: [0.22, 1, 0.36, 1],
                      times: [0, 0.62, 0.84, 1],
                    }}
                  >
                    <div className="grammar-reward-card-float">
                      <img
                        src={grammarRewardImage}
                        alt={hero.name || 'Grammar reward hero'}
                        onError={() => {
                          if (import.meta.env.DEV) {
                            console.warn('Failed to load grammar reward hero image:', grammarRewardImage, { rewardCard });
                          }
                        }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <div className="grammar-reward-card-placeholder" aria-hidden="true">
                    <div className="eq-card-art eq-card-world-grammar is-large">
                      <div className="eq-card-art-symbol">G</div>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </section>

            <motion.p
              className="grammar-reward-gain"
              initial={{ opacity: 0, y: 12 }}
              animate={canStartGrammarAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: motionDuration(0.38), delay: motionDuration(1.85), ease: [0.22, 1, 0.36, 1] }}
            >
              {isAlreadyOwned ? '獲得済みの文法英雄カードです' : gainText}
            </motion.p>

            <motion.div
              className="grammar-reward-action"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={canStartGrammarAnimation ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.96 }}
              transition={{ duration: motionDuration(0.4), delay: motionDuration(2.1), ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => {
                if (canStartGrammarAnimation) {
                  setGrammarAnimationComplete(true);
                }
              }}
            >
              <GoldQuestButton
                onClick={handleGrammarContinue}
                className="eq-reward-claim-button quest-reward-main-button grammar-reward-main-button"
                disabled={!grammarAnimationComplete || isAdvancing}
              >
                {hasNextReward ? '次のカードへ' : 'ホームへ'}
              </GoldQuestButton>
            </motion.div>
          </motion.section>
        </div>
        <EQBottomNav className="eq-home-bottom-nav" />
      </>
    );
  }

  return (
    <>
      <div className={rewardPageClass}>
        <div className="quest-reward-palace-stars" aria-hidden="true" />

        <section className="quest-reward-result" aria-label="クエストクリア">
          <div className="quest-reward-crystal" aria-hidden="true">
            <span />
          </div>
          <h1>CLEAR!</h1>
          <p className="quest-reward-stage-label">{stageCompleteLabel}</p>
          {isGrammarReward || isBossCardReward ? <p className="eq-grammar-reward-mastery">{masteryText}</p> : null}
          <div className="quest-reward-score">
            <strong>{scoreText}</strong>
            <span>{scoreLabel}</span>
          </div>
        </section>

        <p className="quest-reward-gain-label">
          {gainText}
        </p>

        <section className="quest-reward-card-stage" aria-label="新しい英雄カード">
          <motion.div
            className="quest-reward-halo"
            aria-hidden="true"
            animate={{ scale: [0.92, 1.1, 0.92], opacity: [0.42, 0.9, 0.42] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          {sparkleParticles.map((particle) => (
            <motion.span
              key={particle.id}
              className="quest-reward-sparkle"
              aria-hidden="true"
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
              }}
              animate={{
                y: [-8, 9, -8],
                opacity: [0.18, 1, 0.18],
                scale: [0.65, 1.32, 0.65],
              }}
              transition={{ duration: 2.3, repeat: Infinity, delay: particle.delay, ease: 'easeInOut' }}
            />
          ))}

          <motion.div
            className="quest-reward-card-flip"
            initial={{ y: 40, scale: 0.92, opacity: 0 }}
            animate={{ y: 0, scale: isAdvancing ? 1.04 : 1, opacity: 1 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="quest-reward-card-inner"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="quest-reward-card-face quest-reward-card-back">
                <img
                  src={rewardBackImage}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                  }}
                />
                <span className="quest-reward-rarity-badge">{displayRarity}</span>
                <strong>???</strong>
                <p>{rewardCardTypeText}</p>
              </div>
              <div className="quest-reward-card-face quest-reward-card-front">
                <span className="quest-reward-rarity-badge">{displayRarity}</span>
                {rewardImage ? (
                  <img
                    src={rewardImage}
                    alt={hero.name}
                    onError={() => {
                      if (import.meta.env.DEV) {
                        console.warn('Failed to load reward hero image:', rewardImage, { rewardCard });
                      }
                    }}
                  />
                ) : (
                  <div className={`eq-card-art eq-card-world-${worldClass} is-large`}>
                    <div className="eq-card-art-symbol">{worldClass}</div>
                  </div>
                )}
                <div className="quest-reward-card-caption">
                  <h2>{hero.name}</h2>
                  <p>{rewardCardTypeText}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <GoldQuestButton
          onClick={rewardStep === 'reveal' ? revealCard : showNextReward}
          className="eq-reward-claim-button quest-reward-main-button"
          disabled={isAdvancing}
        >
          {rewardStep === 'reveal' ? 'カードを受け取る' : hasNextReward ? '次のカードへ' : 'ホームへ'}
        </GoldQuestButton>
      </div>
      <EQBottomNav className="eq-home-bottom-nav" />
    </>
  );
}
