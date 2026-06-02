import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getHeroCards } from '../api';
import { EQBottomNav, GoldQuestButton } from '../components/eigo';
import { getEigoQuestWorld } from '../config/eigoQuestWorlds';
import {
  clearPendingReward,
  getCardById,
  getPendingRewardQueue,
  savePendingRewardQueue,
} from '../helpers/eigoQuestRewards';
import eigoQuestCards from '../config/eigoQuestCards';

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
    code: String(card.code || card.id || ''),
    worldId: card.worldId || card.world_id || 'wind',
    nameJa: card.nameJa || card.name_ja || '',
    nameZh: card.nameZh || card.name_cn || '',
    sourceJa: card.sourceJa || card.source_ja || card.originJa || card.origin_ja || '',
    rarity: card.rarity || 'R',
    image: card.image || card.imageUrl || card.image_url || '',
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
  const worldId = card.worldId || 'wind';
  if (image.includes(`/cards/${worldId}/`)) return image;
  return image.replace('/assets/eigo-quest/cards/', `/assets/eigo-quest/cards/${worldId}/`);
}

const rewardBackWorldIds = new Set(['wind', 'fire', 'water', 'thunder', 'wood', 'rock', 'light', 'shadow']);

function getRewardCardBackImage(worldId) {
  const normalized = String(worldId || 'wind').trim().toLowerCase();
  const safeWorldId = rewardBackWorldIds.has(normalized) ? normalized : 'wind';
  return `/assets/eigo-quest/cards/back/${safeWorldId}-cover.png`;
}

function getImageFileName(image = '') {
  return String(image).split('?')[0].split('/').pop() || '';
}

function findRewardHero(apiHeroes, pendingReward, fallbackCard) {
  const fallback = normalizeHeroCard(fallbackCard);
  const rewardKeys = [
    pendingReward?.cardId,
    pendingReward?.card_id,
    pendingReward?.heroId,
    pendingReward?.hero_id,
    pendingReward?.code,
    fallback?.id,
    fallback?.code,
    fallback?.heroId,
  ].filter(Boolean).map(String);
  const rewardKeySet = new Set(rewardKeys);
  const rewardWorldId = pendingReward?.worldId || pendingReward?.world_id || fallback?.worldId || '';
  const rewardImageName = getImageFileName(fallback?.image);
  const rewardNameSet = new Set([fallback?.nameJa, fallback?.nameZh].filter(Boolean));
  const matches = (card) => {
    const hero = normalizeHeroCard(card);
    if (!hero) return false;
    const heroKeys = [hero.id, hero.code, hero.heroId].filter(Boolean).map(String);
    if (heroKeys.some((key) => rewardKeySet.has(key))) return true;

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

export default function CardRewardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rewardStep, setRewardStep] = useState('reveal');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [apiHeroes, setApiHeroes] = useState([]);
  const [pendingQueue, setPendingQueue] = useState(() => getPendingRewardQueue());
  const [rewardIndex, setRewardIndex] = useState(0);
  const pendingReward = pendingQueue[rewardIndex] || null;
  const fallbackCard = useMemo(() => eigoQuestCards[0], []);
  const rewardCard = pendingReward
    ? findRewardHero(apiHeroes, pendingReward, getCardById(pendingReward?.cardId) || fallbackCard)
    : null;
  const worldClass = getWorldClass(rewardCard?.worldId);
  const rewardImage = getRewardCardImage(rewardCard);
  const rewardBackImage = getRewardCardBackImage(
    pendingReward?.worldId || pendingReward?.world_id || rewardCard?.worldId,
  );
  const hero = getHeroCopy(rewardCard);
  const hasNextReward = rewardIndex < pendingQueue.length - 1;
  const isGrammarReward = isGrammarRewardSource(pendingReward);
  const grammarCopy = getGrammarRewardCopy(pendingReward, rewardCard?.nameJa);
  const stageCompleteLabel = isGrammarReward
    ? grammarCopy.stageLabel
    : getStageCompleteLabel(pendingReward, rewardCard, searchParams);

  useEffect(() => {
    let cancelled = false;
    getHeroCards()
      .then((payload) => {
        if (!cancelled) setApiHeroes((payload.heroes || []).map(normalizeHeroCard).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setApiHeroes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finishRewards = () => {
    clearPendingReward();
    navigate('/app');
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

  return (
    <>
      <div className={`eq-card-page-wrap quest-reward-page-wrap quest-reward-palace ${isGrammarReward ? 'eq-grammar-reward-page' : ''} is-${rewardStep}`.trim()}>
        <div className="quest-reward-palace-stars" aria-hidden="true" />

        <section className="quest-reward-result" aria-label="クエストクリア">
          <div className="quest-reward-crystal" aria-hidden="true">
            <span />
          </div>
          <h1>CLEAR!</h1>
          <p className="quest-reward-stage-label">{stageCompleteLabel}</p>
          {isGrammarReward ? <p className="eq-grammar-reward-mastery">{grammarCopy.masteryText}</p> : null}
          <div className="quest-reward-score">
            <strong>{isGrammarReward ? (grammarCopy.scoreText || 'CLEAR') : '20 / 20'}</strong>
            <span>{isGrammarReward ? (grammarCopy.scoreLabel || 'Grammar Mastered') : 'Words Mastered'}</span>
          </div>
        </section>

        <p className="quest-reward-gain-label">
          {isGrammarReward ? grammarCopy.gainText : '新しい英雄カードを獲得しました！'}
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
                <span className="quest-reward-rarity-badge">{hero.rarity}</span>
                <strong>???</strong>
                <p>{hero.rarity} Hero</p>
              </div>
              <div className="quest-reward-card-face quest-reward-card-front">
                <span className="quest-reward-rarity-badge">{hero.rarity}</span>
                {rewardImage ? (
                  <img src={rewardImage} alt={hero.name} />
                ) : (
                  <div className={`eq-card-art eq-card-world-${worldClass} is-large`}>
                    <div className="eq-card-art-symbol">{worldClass}</div>
                  </div>
                )}
                <div className="quest-reward-card-caption">
                  <h2>{hero.name}</h2>
                  <p>{hero.rarity} Hero</p>
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
