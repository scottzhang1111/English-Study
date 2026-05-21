import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQBottomNav,
  GoldQuestButton,
  MagicPanel,
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

export default function CardRewardPage() {
  const navigate = useNavigate();
  const pendingReward = useMemo(() => getPendingReward(), []);
  const fallbackCard = useMemo(() => pickRewardCardForProgress(0), []);
  const rewardCard = getCardById(pendingReward?.cardId) || fallbackCard;
  const rewardExp = pendingReward?.exp ?? 50;
  const rewardCoin = pendingReward?.coin ?? 30;
  const worldClass = getWorldClass(rewardCard?.worldId);

  const handleClaim = () => {
    if (rewardCard?.id) addOwnedCardId(rewardCard.id);
    clearPendingReward();
    navigate('/cards');
  };

  return (
    <div className="eq-card-page-wrap">
      <QuestPageLayout
        title="ステージクリア！"
        subtitle="単語も文法もマスターしたね"
        backTo="/app"
        currentStep="reward"
        completedSteps={['words', 'quiz', 'grammar', 'grammarTest']}
        className="eq-card-reward-screen quest-reward-layout"
      >
        <SpiritGuide
          worldName="風の精霊"
          mood="happy"
          messages={['やったね！\nごほうびカードをゲット！']}
        />

        <MagicPanel className="eq-reward-card-showcase quest-reward-showcase">
          <span className="quest-new-ribbon">NEW</span>
          <span className={`eq-rarity-badge rarity-${rewardCard?.rarity || 'R'}`}>{rewardCard?.rarity || 'R'}</span>
          <div className={`eq-card-art eq-card-world-${worldClass} is-large`}>
            <div className="eq-card-art-symbol">{worldClass}</div>
          </div>
          <h2>{rewardCard?.nameJa || '風の精霊'}</h2>
          <div className="eq-reward-list">
            <span>EXP +{rewardExp}</span>
            <span>Coin +{rewardCoin}</span>
            <span>カード獲得</span>
          </div>
        </MagicPanel>

        <GoldQuestButton onClick={handleClaim} className="eq-reward-claim-button">
          つぎのステージへ
        </GoldQuestButton>
        <button type="button" onClick={() => navigate('/app')} className="quest-home-return">
          ホームへ戻る
        </button>
      </QuestPageLayout>

      <EQBottomNav
        items={[
          { label: 'ホーム', to: '/app', icon: 'home' },
          { label: '地図', to: '/study-map', icon: 'map' },
          { label: '学習', to: '/daily-words', icon: 'study' },
          { label: 'カード', to: '/cards', icon: 'cards', active: true },
          { label: '設定', to: '/settings', icon: 'more' },
        ]}
      />
    </div>
  );
}
