import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getHeroCards } from '../api';
import { GoldQuestButton } from '../components/eigo';
import {
  addOwnedCardId,
  clearPendingReward,
  getCardById,
  getPendingReward,
  pickRewardCardForProgress,
} from '../helpers/eigoQuestRewards';

const SPIRIT_IMAGE = '/assets/eigo-quest/spirit_assets/happy.png';

const sparkleParticles = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 17) % 84)}%`,
  top: `${6 + ((index * 29) % 82)}%`,
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

function getHeroSource(card) {
  if (card?.sourceJa || card?.originJa) return card.sourceJa || card.originJa;
  const text = `${card?.descriptionJa || ''} ${card?.nameJa || ''}`;
  if (text.includes('三国')) return '三国志';
  if (text.includes('ギリシャ')) return 'ギリシャ神話';
  if (text.includes('北欧')) return '北欧神話';
  if (text.includes('インド')) return 'インド神話';
  if (text.includes('中国神話')) return '中国神話';
  if (text.includes('日本神話')) return '日本神話';
  if (text.includes('戦国')) return '戦国時代';
  return card?.nameZh || '英雄譚';
}

function getHeroCopy(card) {
  const description = card?.descriptionJa || '光の封印から目覚めた新しい英雄。';
  const sentences = description.split('。').map((line) => line.trim()).filter(Boolean);
  return {
    name: card?.nameJa || card?.nameZh || '新英雄',
    source: getHeroSource(card),
    intro: sentences[0] ? `${sentences[0]}。` : description,
    story: sentences.length > 1 ? `${sentences.slice(1).join('。')}。` : 'これからの冒険で力を貸してくれる仲間。',
  };
}

export default function CardRewardPage() {
  const navigate = useNavigate();
  const [rewardStep, setRewardStep] = useState('reveal');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [apiHeroes, setApiHeroes] = useState([]);
  const pendingReward = useMemo(() => getPendingReward(), []);
  const fallbackCard = useMemo(() => pickRewardCardForProgress(0), []);
  const rewardCard = findRewardHero(apiHeroes, pendingReward, getCardById(pendingReward?.cardId) || fallbackCard);
  const worldClass = getWorldClass(rewardCard?.worldId);
  const rewardImage = getRewardCardImage(rewardCard);
  const hero = getHeroCopy(rewardCard);

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

  useEffect(() => {
    const timer = window.setTimeout(() => setIsFlipped(true), 520);
    return () => window.clearTimeout(timer);
  }, []);

  const claimReward = () => {
    if (rewardCard?.id) addOwnedCardId(rewardCard.id);
    clearPendingReward();
  };

  const showDetail = () => {
    if (rewardStep !== 'reveal' || isAdvancing) return;
    setIsAdvancing(true);
    window.setTimeout(() => {
      setRewardStep('detail');
      setIsAdvancing(false);
    }, 360);
  };

  const goHome = () => {
    claimReward();
    navigate('/app');
  };

  return (
    <div className={`eq-card-page-wrap quest-reward-page-wrap is-${rewardStep}`}>
      {rewardStep === 'reveal' ? (
        <button type="button" className="quest-reward-reveal" onClick={showDetail}>
          <div className="quest-reward-title">
            <span>MISSION COMPLETE!</span>
            <strong>NEW HERO!</strong>
          </div>

          <section className="quest-reward-card-stage" aria-label="新英雄カード">
            <motion.div
              className="quest-reward-halo"
              aria-hidden="true"
              animate={{ scale: [0.9, 1.14, 0.9], opacity: [0.42, 0.92, 0.42] }}
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
                  y: [-9, 10, -9],
                  opacity: [0.18, 1, 0.18],
                  scale: [0.65, 1.35, 0.65],
                }}
                transition={{ duration: 2.3, repeat: Infinity, delay: particle.delay, ease: 'easeInOut' }}
              />
            ))}

            <motion.div
              className="quest-reward-card-flip"
              initial={{ y: 80, scale: 0.88, opacity: 0 }}
              animate={{ y: 0, scale: isAdvancing ? 1.05 : 1, opacity: 1 }}
              transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="quest-reward-card-inner"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: isFlipped ? (isAdvancing ? 198 : 180) : 0 }}
                transition={{ duration: isAdvancing ? 0.32 : 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="quest-reward-card-face quest-reward-card-back">
                  <span>EIGO QUEST</span>
                  <strong>{worldClass}</strong>
                </div>
                <div className="quest-reward-card-face quest-reward-card-front">
                  <span className="quest-new-ribbon">NEW HERO</span>
                  {rewardImage ? (
                    <img src={rewardImage} alt={hero.name} />
                  ) : (
                    <div className={`eq-card-art eq-card-world-${worldClass} is-large`}>
                      <div className="eq-card-art-symbol">{worldClass}</div>
                    </div>
                  )}
                  <div className="quest-reward-card-caption">
                    <h2>{hero.name}</h2>
                    <p aria-label="レアリティ">★★★★★</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </section>

          <div className="quest-reward-spirit-bubble">
            <img src={SPIRIT_IMAGE} alt="" />
            <p>
              すごい！<br />
              {hero.name}を仲間にしたよ！
            </p>
          </div>

          <p className="quest-reward-tap-label">タップして続ける</p>
        </button>
      ) : (
        <section className="quest-reward-detail" aria-label="英雄詳細">
          <div className="quest-reward-detail-card">
            <div className="quest-reward-detail-art">
              {rewardImage ? (
                <img src={rewardImage} alt={hero.name} />
              ) : (
                <div className={`eq-card-art eq-card-world-${worldClass} is-large`}>
                  <div className="eq-card-art-symbol">{worldClass}</div>
                </div>
              )}
            </div>
            <div className="quest-reward-detail-copy">
              <h1>{hero.name}</h1>
              <span>{hero.source}</span>
              <p>{hero.intro}</p>
              <p>{hero.story}</p>
            </div>
          </div>

          <GoldQuestButton onClick={goHome} className="eq-reward-claim-button">
            ホームへ
          </GoldQuestButton>
        </section>
      )}
    </div>
  );
}
