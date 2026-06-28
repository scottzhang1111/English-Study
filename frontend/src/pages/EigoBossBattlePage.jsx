import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQChoiceButton,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQPageHeader,
  EQPageShell,
} from '../components/eigo';
import {
  FIRST_BOSS_BATTLE,
  FIRST_BOSS_QUESTIONS,
  FIRST_BOSS_REWARD,
} from '../data/eigoBossBattleV1';
import './EigoBossBattlePage.css';

const COUNTER_DAMAGE = 15;
const INITIAL_MESSAGE = '風の守護者たちと一緒に挑戦しよう！';
const FAILED_MESSAGE = 'Boss の弱点をもう一度練習しよう';

function shuffleQuestions(questions) {
  const deck = [...questions];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function createInitialBattleState() {
  return {
    bossHp: FIRST_BOSS_BATTLE.boss.hp,
    playerHp: FIRST_BOSS_BATTLE.playerHp,
    activeHeroIndex: 0,
    combo: 0,
    questionDeck: shuffleQuestions(FIRST_BOSS_QUESTIONS),
    currentQuestionIndex: 0,
    message: INITIAL_MESSAGE,
    battleStatus: 'playing',
    bossReaction: '',
  };
}

function HpBar({ label, value, max, tone = 'cyan' }) {
  const safeValue = Math.max(0, value);
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((safeValue / max) * 100))) : 0;

  return (
    <section className={`eq-boss-hp is-${tone}`} aria-label={label}>
      <div className="eq-boss-hp__row">
        <strong>{label}</strong>
        <span>{safeValue} / {max}</span>
      </div>
      <div className="eq-boss-hp__track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}

export default function EigoBossBattlePage() {
  const navigate = useNavigate();
  const battle = FIRST_BOSS_BATTLE;
  const [state, setState] = useState(createInitialBattleState);
  const currentQuestion = state.questionDeck[state.currentQuestionIndex];
  const activeHero = battle.heroes[state.activeHeroIndex] || battle.heroes[0];
  const rewardPath = FIRST_BOSS_REWARD.nextPath || '/card-reward?source=wind_trial_001';

  const resetBattle = () => {
    setState(createInitialBattleState());
  };

  const clearBossReactionSoon = () => {
    window.setTimeout(() => {
      setState((current) => ({ ...current, bossReaction: '' }));
    }, 360);
  };

  const moveToNextQuestion = (draft) => {
    const nextQuestionIndex = draft.currentQuestionIndex + 1;
    if (nextQuestionIndex >= draft.questionDeck.length) {
      return {
        ...draft,
        currentQuestionIndex: draft.currentQuestionIndex,
        battleStatus: 'failed',
        message: FAILED_MESSAGE,
      };
    }

    return {
      ...draft,
      currentQuestionIndex: nextQuestionIndex,
    };
  };

  const answerQuestion = (choice) => {
    if (state.battleStatus !== 'playing' || !currentQuestion) return;

    const isCorrect = choice === currentQuestion.answer;
    if (isCorrect) {
      const damage = activeHero.attack;
      const nextBossHp = Math.max(0, state.bossHp - damage);
      const nextState = {
        ...state,
        bossHp: nextBossHp,
        combo: state.combo + 1,
        activeHeroIndex: (state.activeHeroIndex + 1) % battle.heroes.length,
        message: `Good! ${activeHero.name} のスキル発動！Boss に ${damage} ダメージ！`,
        bossReaction: 'is-hit',
      };

      if (nextBossHp <= 0) {
        setState({
          ...nextState,
          battleStatus: 'clear',
          message: '風の試練クリア！Boss カードを手に入れた！',
        });
        clearBossReactionSoon();
        return;
      }

      setState(moveToNextQuestion(nextState));
      clearBossReactionSoon();
      return;
    }

    const nextPlayerHp = Math.max(0, state.playerHp - COUNTER_DAMAGE);
    const nextState = {
      ...state,
      playerHp: nextPlayerHp,
      combo: 0,
      message: 'もう少し！Boss の反撃！',
      bossReaction: 'is-counter',
    };

    if (nextPlayerHp <= 0) {
      setState({
        ...nextState,
        battleStatus: 'failed',
        message: FAILED_MESSAGE,
      });
      clearBossReactionSoon();
      return;
    }

    setState(moveToNextQuestion(nextState));
    clearBossReactionSoon();
  };

  const renderHeroParty = () => (
    <section className="eq-boss-party" aria-label="Hero party">
      {battle.heroes.map((hero, index) => (
        <article
          key={hero.id}
          className={`eq-boss-hero ${index === state.activeHeroIndex && state.battleStatus === 'playing' ? 'is-active' : ''}`}
        >
          <img src={hero.image} alt={hero.name} />
          <span>{hero.name}</span>
        </article>
      ))}
    </section>
  );

  return (
    <EQPageShell
      className="eq-boss-battle-page"
      contentClassName="eq-boss-battle-content"
      maxWidth="430px"
      withBottomNav
      bottomNavClassName="eq-learning-hub-bottom-nav"
    >
      <EQPageHeader
        eyebrow={`STAGE ${battle.stage} BOSS`}
        title={battle.title}
        subtitle={battle.subtitle}
        icon="風"
        meta={(
          <>
            <EQFantasyBadge variant="cyan">Wind Realm</EQFantasyBadge>
            <EQFantasyBadge>Combo {state.combo}</EQFantasyBadge>
          </>
        )}
      />

      <EQFantasyCard hideHeader className={`eq-boss-card ${state.bossReaction}`}>
        <div className="eq-boss-card__image-frame">
          <img src={battle.boss.image} alt={battle.boss.name} />
        </div>
        <div className="eq-boss-card__copy">
          <span>{battle.boss.title}</span>
          <h2>{battle.boss.name}</h2>
        </div>
        <HpBar label="Boss HP" value={state.bossHp} max={battle.boss.hp} tone="rose" />
      </EQFantasyCard>

      <HpBar label="Player HP" value={state.playerHp} max={battle.playerHp} />

      <p className={`eq-boss-battle-message is-${state.battleStatus}`} role="status">
        {state.message}
      </p>

      {state.battleStatus === 'clear' ? (
        <EQFantasyCard hideHeader className="eq-boss-result-card is-clear">
          <div className="eq-boss-result-card__copy">
            <span>CLEAR!</span>
            <h2>風の試練クリア！</h2>
            <p>Boss カードを手に入れた！</p>
          </div>
          <div className="eq-boss-result-card__reward">
            <img src={battle.boss.image} alt={`${battle.boss.name} reward`} />
            <strong>{battle.boss.name}</strong>
          </div>
          <EQFantasyButton fullWidth onClick={() => navigate(rewardPath)}>
            カードを見る
          </EQFantasyButton>
        </EQFantasyCard>
      ) : state.battleStatus === 'failed' ? (
        <EQFantasyCard hideHeader className="eq-boss-result-card is-failed">
          <div className="eq-boss-result-card__copy">
            <span>TRY AGAIN</span>
            <h2>{FAILED_MESSAGE}</h2>
            <p>風の守護者たちと、もう一度挑戦しよう。</p>
          </div>
          <EQFantasyButton fullWidth onClick={resetBattle}>
            もう一度挑戦
          </EQFantasyButton>
        </EQFantasyCard>
      ) : (
        <EQFantasyCard
          className="eq-boss-question-card"
          eyebrow="Battle Question"
          title={currentQuestion?.prompt || '問題を読み込んでいます'}
          actions={<EQFantasyBadge variant="cyan">Q{state.currentQuestionIndex + 1} / {state.questionDeck.length}</EQFantasyBadge>}
        >
          <div className="eq-boss-active-hero">
            <span>Active Hero</span>
            <strong>{activeHero.name}</strong>
          </div>
          <div className="eq-boss-choice-grid">
            {(currentQuestion?.choices || []).map((choice, index) => (
              <EQChoiceButton
                key={`${currentQuestion.id}-${choice}`}
                badge={String.fromCharCode(65 + index)}
                onClick={() => answerQuestion(choice)}
              >
                {choice}
              </EQChoiceButton>
            ))}
          </div>
        </EQFantasyCard>
      )}

      {renderHeroParty()}
    </EQPageShell>
  );
}
