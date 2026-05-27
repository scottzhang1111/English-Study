import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  GoldQuestButton,
  QuestPageLayout,
  SpiritGuide,
} from '../components/eigo';
import {
  addOwnedCardId,
  clearPendingReward,
  getCardById,
  getPendingReward,
  pickRewardCardForProgress,
} from '../helpers/eigoQuestRewards';

const sparkleParticles = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${12 + ((index * 17) % 76)}%`,
  top: `${8 + ((index * 29) % 74)}%`,
  delay: (index % 6) * 0.18,
  size: 4 + (index % 4) * 2,
}));

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
  const worldId = card.worldId || 'wind';
  if (card.image.includes(`/cards/${worldId}/`)) return card.image;
  return card.image.replace('/assets/eigo-quest/cards/', `/assets/eigo-quest/cards/${worldId}/`);
}

export default function CardRewardPage() {
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);
  const pendingReward = useMemo(() => getPendingReward(), []);
  const fallbackCard = useMemo(() => pickRewardCardForProgress(0), []);
  const rewardCard = getCardById(pendingReward?.cardId) || fallbackCard;
  const rewardExp = pendingReward?.exp ?? 50;
  const rewardCoin = pendingReward?.coin ?? 30;
  const worldClass = getWorldClass(rewardCard?.worldId);
  const rewardImage = getRewardCardImage(rewardCard);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsFlipped(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  const handleClaim = () => {
    if (rewardCard?.id) addOwnedCardId(rewardCard.id);
    clearPendingReward();
    navigate('/app/world-stage');
  };

  return (
    <div className="eq-card-page-wrap quest-reward-page-wrap">
      <QuestPageLayout
        title="ステージクリア！"
        subtitle="単語も文法もマスターしたね"
        backTo="/app"
        currentStep="reward"
        completedSteps={['words', 'quiz', 'grammar', 'grammarTest']}
        className="eq-card-reward-screen quest-reward-layout"
      >
        <section className="quest-reward-spirit-row">
          <SpiritGuide
            worldName="風の精霊"
            mood="happy"
            messages={['やったね！ごほうびカードをゲット！']}
            className="quest-reward-spirit"
          />
        </section>

        <section className="quest-reward-card-stage" aria-label="獲得カード">
          <motion.div
            className="quest-reward-halo"
            aria-hidden="true"
            animate={{ scale: [0.94, 1.1, 0.94], opacity: [0.42, 0.82, 0.42] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
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
                y: [-5, 8, -5],
                opacity: [0.3, 1, 0.3],
                scale: [0.75, 1.25, 0.75],
              }}
              transition={{ duration: 2.4, repeat: Infinity, delay: particle.delay, ease: 'easeInOut' }}
            />
          ))}

          <div className="quest-reward-card-flip">
            <motion.div
              className="quest-reward-card-inner"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="quest-reward-card-face quest-reward-card-back">
                <span>英語クエスト</span>
                <strong>{worldClass}</strong>
              </div>
              <div className="quest-reward-card-face quest-reward-card-front">
                <span className="quest-new-ribbon">NEW</span>
                {rewardImage ? (
                  <img src={rewardImage} alt={rewardCard.nameJa || 'そよ風の精霊'} />
                ) : (
                  <div className={`eq-card-art eq-card-world-${worldClass} is-large`}>
                    <div className="eq-card-art-symbol">{worldClass}</div>
                  </div>
                )}
                <div className="quest-reward-card-caption">
                  <h2>{rewardCard?.nameJa || 'そよ風の精霊'}</h2>
                  <p aria-label="星5">★★★★★</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="quest-reward-bonus-row" aria-label="獲得報酬">
          <span><b>EXP</b> +{rewardExp}</span>
          <span><b>Coin</b> +{rewardCoin}</span>
          <span>英雄カード獲得</span>
        </div>

        <div className="quest-reward-complete-bar" aria-label="ステージ完了状況">
          <span><b>単語学習</b> 5/5 完了</span>
          <span><b>単語小テスト</b> 合格</span>
          <span><b>文法の神殿</b> 完了</span>
          <span><b>文法テスト</b> 合格</span>
        </div>

        <GoldQuestButton onClick={handleClaim} className="eq-reward-claim-button">
          つぎのステージへ
        </GoldQuestButton>
        <button type="button" onClick={() => navigate('/app')} className="quest-home-return">
          ホームへ戻る
        </button>
      </QuestPageLayout>
    </div>
  );
}
