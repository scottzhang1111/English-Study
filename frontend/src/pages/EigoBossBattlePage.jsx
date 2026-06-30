import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQChoiceButton,
  EQFantasyButton,
  EQFantasyCard,
  EQPageShell,
} from '../components/eigo';
import {
  FIRST_BOSS_BATTLE,
  FIRST_BOSS_QUESTIONS,
  FIRST_BOSS_REWARD,
} from '../data/eigoBossBattleV1';
import { playBattleSfx, preloadBattleSfx } from '../utils/battleSfx';
import './EigoBossBattlePage.css';

const COUNTER_DAMAGE = 15;
const SKILL_SEQUENCE_MAP = {
  wind_slash: {
    folder: '/assets/eigo-quest/effects/wind/wind-cut-impact-asset/frames/',
    startFrame: 1,
    endFrame: 16,
    placement: 'boss',
    className: 'eq-skill-sequence--wind-cut',
    duration: 700,
    size: 300,
    offsetX: 0,
    offsetY: 0,
    rotate: -8,
  },
  gale_thrust: {
    folder: '/assets/eigo-quest/effects/wind/wind-pierce-impact-asset/frames/',
    startFrame: 0,
    endFrame: 12,
    placement: 'boss',
    className: 'eq-skill-sequence--wind-pierce',
    duration: 560,
    size: 250,
    offsetX: 14,
    offsetY: -10,
    rotate: 4,
  },
  cyclone_combo: {
    folder: '/assets/eigo-quest/effects/wind/wind-combo-impact-asset/frames/',
    startFrame: 0,
    endFrame: 18,
    placement: 'boss',
    className: 'eq-skill-sequence--wind-combo',
    duration: 760,
    size: 300,
    offsetX: 0,
    offsetY: 0,
    rotate: 0,
  },
  wind_blessing: {
    folder: '/assets/eigo-quest/effects/wind/wind-blessing-aura-asset/frames/',
    startFrame: 0,
    endFrame: 20,
    placement: 'hero',
    className: 'eq-skill-sequence--wind-blessing',
    duration: 860,
    size: 286,
    offsetX: 0,
    offsetY: -22,
    rotate: 0,
  },
};
const INITIAL_MESSAGE = '答えを選んでスキル発動！';
const FAILED_MESSAGE = 'Boss の弱点をもう一度練習しよう';

function getHeroSkillName(hero) {
  return hero?.skill?.name || 'スキル発動';
}

function getHeroSkillMotion(hero) {
  return hero?.skill?.motion || 'wind_slash';
}

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

function getTextLength(value) {
  return Array.from(String(value || '')).length;
}

function getQuestionTextClass(questionText) {
  const length = getTextLength(questionText);
  if (length <= 18) return 'q-xl';
  if (length <= 30) return 'q-lg';
  if (length <= 42) return 'q-md';
  if (length <= 58) return 'q-sm';
  return 'q-xs';
}

function getAnswerTextClass(answerText) {
  const length = getTextLength(answerText);
  if (length <= 6) return 'ans-xl';
  if (length <= 10) return 'ans-lg';
  if (length <= 14) return 'ans-md';
  if (length <= 18) return 'ans-sm';
  return 'ans-xs';
}

function getViewportRect(element) {
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

function getSkillEffectClass(skillMotion) {
  return `skill-effect-${(skillMotion || 'wind_slash').replaceAll('_', '-')}`;
}

function getPngFrameSrc(folder, frameIndex) {
  const normalizedFolder = String(folder || '').replace(/\/?$/, '/');
  return `${normalizedFolder}frame_${String(frameIndex).padStart(3, '0')}.png`;
}

function getSequenceFrameIndexes(sequenceConfig) {
  if (!sequenceConfig) return [];

  const frames = [];
  for (let index = sequenceConfig.startFrame; index <= sequenceConfig.endFrame; index += 1) {
    frames.push(index);
  }
  return frames;
}

function getSkillSequenceDuration(skillMotion) {
  return SKILL_SEQUENCE_MAP[skillMotion]?.duration || 700;
}

function SkillPngSequence({
  sequenceConfig,
  playKey,
  reducedMotion,
  className = '',
  onError,
}) {
  const [frameIndex, setFrameIndex] = useState(sequenceConfig?.startFrame || 0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFrameIndex(sequenceConfig?.startFrame || 0);
    setFailed(false);
  }, [playKey, sequenceConfig]);

  useEffect(() => {
    if (!sequenceConfig?.folder || failed || typeof window === 'undefined') return undefined;

    const frameIndexes = getSequenceFrameIndexes(sequenceConfig);
    const totalFrames = frameIndexes.length;
    if (!totalFrames) return undefined;

    if (reducedMotion) {
      setFrameIndex(frameIndexes[totalFrames - 1]);
      return undefined;
    }

    let animationFrameId = 0;
    const startedAt = performance.now();
    const duration = Math.max(sequenceConfig.duration || 1, 1);
    const tick = (timestamp) => {
      const elapsed = Math.min(timestamp - startedAt, duration);
      const progress = Math.max(0, Math.min(1, elapsed / duration));
      const frameOffset = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
      setFrameIndex(frameIndexes[frameOffset]);

      if (elapsed < duration) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [failed, playKey, reducedMotion, sequenceConfig]);

  if (!sequenceConfig?.folder || failed) return null;

  return (
    <img
      className={`eq-skill-png-sequence ${className}`.trim()}
      src={getPngFrameSrc(sequenceConfig.folder, frameIndex)}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}

function createWindBladePaths(sequence) {
  const { from, to } = sequence;
  const midX = (from.centerX + to.centerX) / 2;
  const midY = (from.centerY + to.centerY) / 2;
  const lift = Math.max(34, Math.min(88, Math.abs(to.centerY - from.centerY) * 0.22));

  return [
    {
      d: `M ${from.centerX} ${from.centerY} Q ${midX - 42} ${midY - lift} ${to.centerX - 9} ${to.centerY - 5}`,
      delay: 0,
    },
    {
      d: `M ${from.centerX + 12} ${from.centerY - 10} Q ${midX + 24} ${midY - lift - 20} ${to.centerX + 16} ${to.centerY + 2}`,
      delay: 0.08,
    },
    {
      d: `M ${from.centerX - 10} ${from.centerY + 8} Q ${midX - 8} ${midY + lift * 0.15} ${to.centerX - 2} ${to.centerY + 18}`,
      delay: 0.15,
    },
  ];
}

function WindAttackOverlay({ sequence, reducedMotion, sequenceLoadState }) {
  const [pngSequenceFailed, setPngSequenceFailed] = useState(false);
  const skillMotion = sequence?.motion || 'wind_slash';

  useEffect(() => {
    setPngSequenceFailed(false);
  }, [sequence?.id, skillMotion]);

  if (!sequence) return null;

  const skillAsset = SKILL_SEQUENCE_MAP[skillMotion];
  const cloneWidth = Math.min(Math.max(sequence.from.width, 54), 72);
  const cloneHeight = cloneWidth * 1.34;
  const startX = sequence.from.centerX - cloneWidth / 2;
  const startY = sequence.from.centerY - cloneHeight / 2;
  const endX = sequence.to.centerX - cloneWidth / 2;
  const endY = sequence.to.centerY - cloneHeight / 2;
  const showImpact = sequence.phase === 'impact';
  const bladePaths = createWindBladePaths(sequence);
  const showCyclone = showImpact && skillMotion === 'cyclone_combo';
  const showBlessing = skillMotion === 'wind_blessing';
  const showComboBonus = showCyclone && sequence.combo >= 2;
  const hasPngSequence = Boolean(skillAsset?.folder && getSequenceFrameIndexes(skillAsset).length);
  const canUsePngSequence = hasPngSequence && sequenceLoadState?.[skillMotion] === true && !pngSequenceFailed;
  const hasRealSkillAsset = Boolean(skillAsset && canUsePngSequence);
  const showSkillAsset = hasRealSkillAsset;
  const showLegacyImpact = showImpact && !hasRealSkillAsset;
  const showDamageNumber = showImpact && skillMotion !== 'wind_blessing';
  const showLegacyCyclone = showCyclone && !hasRealSkillAsset;
  const showLegacyBlessing = showBlessing && !hasRealSkillAsset;
  const showFallbackTravelEffect = !hasRealSkillAsset;
  const showAttackClone = !(hasRealSkillAsset && skillAsset?.placement === 'hero');
  const deltaX = sequence.to.centerX - sequence.from.centerX;
  const deltaY = sequence.to.centerY - sequence.from.centerY;
  const beamDistance = Math.max(120, Math.hypot(deltaX, deltaY));
  const beamAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  const beamX = sequence.from.centerX + deltaX / 2 - beamDistance / 2;
  const beamY = sequence.from.centerY + deltaY / 2;
  const assetCenter = skillAsset?.placement === 'hero' ? sequence.party || sequence.from : sequence.to;
  const assetInitialScale = skillMotion === 'gale_thrust' ? 0.64 : skillMotion === 'cyclone_combo' ? 0.7 : skillMotion === 'wind_blessing' ? 0.62 : 0.72;
  const assetScaleFrames = skillMotion === 'gale_thrust'
    ? [0.64, 1.12, 1, 0.9]
    : skillMotion === 'cyclone_combo'
      ? [0.7, 1.02, 1.1, 1.02, 0.94]
      : skillMotion === 'wind_blessing'
        ? [0.62, 1.04, 1.08, 1]
        : [0.72, 1.06, 1.02, 0.96];

  return (
    <div className={`eq-battle-animation-layer is-hero-skill is-${skillMotion} ${getSkillEffectClass(skillMotion)} ${hasRealSkillAsset ? `has-real-skill-asset has-${skillMotion.replaceAll('_', '-')}-asset` : ''}`} aria-hidden="true">
      {showFallbackTravelEffect ? (
        <>
          <motion.div
            className={`eq-cinematic-skill-beam is-${skillMotion}`}
            style={{
              left: beamX,
              top: beamY,
              width: beamDistance,
              rotate: beamAngle,
            }}
            initial={{ opacity: 0, scaleX: 0.08 }}
            animate={{
              opacity: reducedMotion ? 0.42 : [0, 1, 0],
              scaleX: reducedMotion ? 1 : [0.08, 1.08, 1.16],
            }}
            transition={{
              duration: reducedMotion ? 0.01 : skillMotion === 'gale_thrust' ? 0.34 : 0.48,
              ease: 'easeOut',
            }}
          />
          <svg
            className="eq-wind-slash-layer"
            viewBox={`0 0 ${sequence.containerWidth} ${sequence.containerHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`eqWindBlade-${sequence.id}`} x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(53, 217, 255, 0)" />
                <stop offset="35%" stopColor="#eaffff" />
                <stop offset="70%" stopColor="#35d9ff" />
                <stop offset="100%" stopColor="#ffd35a" />
              </linearGradient>
            </defs>
            {bladePaths.map((blade, index) => (
              <motion.path
                key={`${sequence.id}-blade-${index}`}
                d={blade.d}
                pathLength="1"
                className={`eq-wind-slash-path is-${index + 1}`}
                stroke={`url(#eqWindBlade-${sequence.id})`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: reducedMotion ? 1 : [0, 1, 1],
                  opacity: reducedMotion ? 0 : [0, 1, 0],
                }}
                transition={{
                  duration: reducedMotion ? 0.01 : 0.42,
                  delay: reducedMotion ? 0 : blade.delay,
                  ease: 'easeOut',
                }}
              />
            ))}
          </svg>
        </>
      ) : null}

      {showAttackClone ? (
        <motion.div
          className={`eq-attack-clone-card is-${skillMotion}`}
          style={{ width: cloneWidth, height: cloneHeight }}
          initial={{ x: startX, y: startY, opacity: 0.96, rotate: -7, scale: 0.92 }}
          animate={showImpact || reducedMotion
            ? { x: endX, y: endY, opacity: 0, rotate: 12, scale: 0.56 }
            : { x: endX, y: endY, opacity: 1, rotate: 8, scale: 1.16 }}
          exit={{ opacity: 0, scale: 0.52 }}
          transition={{ duration: reducedMotion ? 0.01 : 0.5, ease: [0.2, 0.8, 0.18, 1] }}
        >
          <img src={sequence.heroImage} alt="" />
        </motion.div>
      ) : null}

      <AnimatePresence>
        {showLegacyBlessing ? (
          <motion.div
            key={`${sequence.id}-blessing`}
            className="eq-wind-blessing-aura"
            style={{ left: (sequence.party || sequence.from).centerX, top: (sequence.party || sequence.from).centerY }}
            initial={{ opacity: 0, scale: 0.44 }}
            animate={{ opacity: reducedMotion ? 0.55 : [0, 0.9, 0], scale: reducedMotion ? 1 : [0.44, 1.1, 1.42] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.58, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showLegacyBlessing ? (
          <motion.div
            key={`${sequence.id}-party-blessing`}
            className="eq-wind-party-blessing"
            style={{
              left: (sequence.party || sequence.from).centerX,
              top: (sequence.party || sequence.from).centerY + 20,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: reducedMotion ? 0.55 : [0, 0.85, 0], scale: reducedMotion ? 1 : [0.8, 1.18, 1.36] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.58, ease: 'easeOut' }}
          >
            <span>GUARD</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showSkillAsset ? (
          <motion.div
            key={`${sequence.id}-${skillMotion}-asset`}
            className={`eq-skill-asset-layer eq-skill-asset-layer--${skillAsset.placement} ${skillAsset.className}`}
            style={{
              left: assetCenter.centerX - skillAsset.size / 2 + skillAsset.offsetX,
              top: assetCenter.centerY - skillAsset.size / 2 + skillAsset.offsetY,
              width: skillAsset.size,
              height: skillAsset.size,
            }}
            initial={{ opacity: 0, scale: assetInitialScale, rotate: skillAsset.rotate }}
            animate={{
              opacity: reducedMotion ? 0.9 : [0, 1, 1, 1],
              scale: reducedMotion ? 1 : assetScaleFrames,
              rotate: skillAsset.rotate,
            }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: reducedMotion ? 0.01 : skillAsset.duration / 1000, ease: 'easeOut' }}
          >
            {canUsePngSequence ? (
              <SkillPngSequence
                key={`${sequence.id}-${skillMotion}-png`}
                sequenceConfig={skillAsset}
                playKey={sequence.id}
                reducedMotion={reducedMotion}
                onError={() => setPngSequenceFailed(true)}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showLegacyImpact ? (
          <motion.div
            key={`${sequence.id}-impact`}
            className="eq-wind-impact"
            style={{ left: sequence.to.centerX, top: sequence.to.centerY }}
            initial={{ opacity: 0, scale: 0.34, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.36 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.24, ease: 'easeOut' }}
          >
            <span className="eq-wind-impact__burst" />
            <span className="eq-wind-impact__ring" />
            <span className="eq-wind-impact__slash" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showDamageNumber ? (
          <motion.span
            key={`${sequence.id}-damage`}
            className="eq-damage-number eq-damage-number--standalone damage-burst"
            style={{ left: sequence.to.centerX, top: sequence.to.centerY }}
            initial={{ opacity: 0, scale: 0.62, y: 10 }}
            animate={{ opacity: reducedMotion ? 1 : [0, 1, 1, 0], scale: reducedMotion ? 1 : [0.62, 1.22, 1, 0.94], y: reducedMotion ? 0 : [10, -8, -18, -30] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.58, ease: 'easeOut' }}
          >
            -{sequence.damage}
          </motion.span>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showLegacyCyclone ? (
          <motion.div
            key={`${sequence.id}-cyclone`}
            className="eq-cyclone-combo-ring"
            style={{ left: sequence.to.centerX, top: sequence.to.centerY }}
            initial={{ opacity: 0, scale: 0.38, rotate: 0 }}
            animate={{ opacity: reducedMotion ? 0.7 : [0, 1, 0], scale: reducedMotion ? 1 : [0.38, 1.08, 1.36], rotate: reducedMotion ? 0 : 260 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.62, ease: 'easeOut' }}
          >
            <span className="eq-cyclone-combo-ring__hit is-1" />
            <span className="eq-cyclone-combo-ring__hit is-2" />
            {showComboBonus ? <span className="eq-combo-bonus-burst">COMBO BONUS</span> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showComboBonus && hasRealSkillAsset ? (
          <motion.span
            key={`${sequence.id}-combo-bonus`}
            className="eq-combo-bonus-burst eq-combo-bonus-burst--standalone"
            style={{ left: sequence.to.centerX, top: sequence.to.centerY + 34 }}
            initial={{ opacity: 0, scale: 0.72, y: 8 }}
            animate={{ opacity: reducedMotion ? 0.9 : [0, 1, 0], scale: reducedMotion ? 1 : [0.72, 1.12, 1], y: reducedMotion ? 0 : [8, -2, -12] }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.56, ease: 'easeOut' }}
          >
            COMBO BONUS
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BossCounterOverlay({ sequence, reducedMotion }) {
  if (!sequence) return null;

  const cloneWidth = Math.min(Math.max(sequence.from.width, 66), 88);
  const cloneHeight = cloneWidth * 1.28;
  const startX = sequence.from.centerX;
  const startY = sequence.from.centerY;
  const endX = sequence.to.centerX;
  const endY = sequence.to.centerY;
  const cloneStartX = startX - cloneWidth / 2;
  const cloneStartY = startY - cloneHeight / 2;
  const cloneEndX = endX - cloneWidth / 2;
  const cloneEndY = endY - cloneHeight / 2;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.max(120, Math.hypot(deltaX, deltaY));
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  const slashX = startX + deltaX / 2 - distance / 2;
  const slashY = startY + deltaY / 2 - 7;

  return (
    <div className="eq-battle-animation-layer is-counter boss-counter-flash" aria-hidden="true">
      <motion.div
        className="eq-boss-attack-clone-card"
        style={{ width: cloneWidth, height: cloneHeight }}
        initial={{ x: cloneStartX, y: cloneStartY, opacity: 0, rotate: 2, scale: 0.92 }}
        animate={reducedMotion
          ? { x: cloneStartX, y: cloneStartY, opacity: 0.72, rotate: 0, scale: 1 }
          : {
              x: [cloneStartX, cloneStartX - 10, cloneEndX],
              y: [cloneStartY, cloneStartY - 8, cloneEndY],
              opacity: [0, 1, 1],
              rotate: [2, -3, -8],
              scale: [0.92, 1.08, 1.16],
            }}
        exit={{ opacity: 0, scale: 0.82, rotate: 0 }}
        transition={{
          duration: reducedMotion ? 0.01 : 0.5,
          times: reducedMotion ? undefined : [0, 0.28, 1],
          ease: [0.2, 0.8, 0.18, 1],
        }}
      >
        <img src={sequence.bossImage} alt="" />
      </motion.div>
      <motion.div
        className="eq-boss-counter-slash"
        style={{
          left: slashX,
          top: slashY,
          width: distance,
        }}
        initial={{ opacity: 0, rotate: angle, scaleX: 0.16 }}
        animate={{ opacity: reducedMotion ? 0.28 : [0, 1, 0], rotate: angle, scaleX: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.42, ease: 'easeOut' }}
      />
      <motion.div
          className="eq-boss-counter-impact"
          style={{ left: endX, top: endY }}
        initial={{ opacity: 0, scale: 0.45 }}
        animate={{ opacity: reducedMotion ? 0.7 : [0, 1, 0], scale: reducedMotion ? 1 : [0.45, 1.1, 1.35] }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.46, ease: 'easeOut', delay: reducedMotion ? 0 : 0.12 }}
      >
        <span className="eq-counter-damage-number damage-burst">-{sequence.damage || COUNTER_DAMAGE}</span>
      </motion.div>
      <motion.div
        className="eq-player-damage-burst damage-burst"
        initial={{ opacity: 0, scale: 0.62, y: 8 }}
        animate={{ opacity: reducedMotion ? 1 : [0, 1, 1, 0], scale: reducedMotion ? 1 : [0.62, 1.24, 1, 0.94], y: reducedMotion ? 0 : [8, -8, -18, -30] }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.58, ease: 'easeOut' }}
      >
        -{sequence.damage || COUNTER_DAMAGE}
      </motion.div>
    </div>
  );
}

export default function EigoBossBattlePage() {
  const navigate = useNavigate();
  const battle = FIRST_BOSS_BATTLE;
  const [state, setState] = useState(createInitialBattleState);
  const [attackSequence, setAttackSequence] = useState(null);
  const [counterSequence, setCounterSequence] = useState(null);
  const [actionEffect, setActionEffect] = useState(null);
  const [sequenceLoadState, setSequenceLoadState] = useState({});
  const [isResolving, setIsResolving] = useState(false);
  const battleRef = useRef(null);
  const bossCardRef = useRef(null);
  const heroPartyRef = useRef(null);
  const heroCardRefs = useRef([]);
  const actionEffectIdRef = useRef(0);
  const timeoutRefs = useRef([]);
  const reducedMotion = useReducedMotion();
  const currentQuestion = state.questionDeck[state.currentQuestionIndex];
  const currentQuestionText = currentQuestion?.prompt || '問題を読み込んでいます';
  const currentQuestionLength = getTextLength(currentQuestionText);
  const questionTextClass = getQuestionTextClass(currentQuestionText);
  const dialogueClass = currentQuestionLength > 58 ? 'is-question-extra-long' : currentQuestionLength > 40 ? 'is-question-long' : 'is-question-short';
  const activeHero = battle.heroes[state.activeHeroIndex] || battle.heroes[0];
  const rewardPath = FIRST_BOSS_REWARD.nextPath || '/card-reward?source=wind_trial_001';
  const bossAura = battle.boss.aura || {};
  const playerHpPercent = battle.playerHp > 0 ? Math.max(0, Math.min(100, (state.playerHp / battle.playerHp) * 100)) : 0;
  const bossHpPercent = battle.boss.hp > 0 ? Math.max(0, Math.min(100, (state.bossHp / battle.boss.hp) * 100)) : 0;
  const bossHudStyle = {
    '--eq-boss-aura-primary': bossAura.primary || 'rgba(255, 25, 91, 0.34)',
    '--eq-boss-aura-secondary': bossAura.secondary || 'rgba(88, 14, 64, 0.48)',
    '--eq-boss-aura-shadow': bossAura.shadow || 'rgba(142, 9, 54, 0.24)',
  };

  useEffect(() => () => {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current = [];
  }, []);

  useEffect(() => {
    preloadBattleSfx();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let isMounted = true;
    const preloadedImages = [];

    Object.entries(SKILL_SEQUENCE_MAP).forEach(([skillMotion, sequenceConfig]) => {
      const frameIndexes = getSequenceFrameIndexes(sequenceConfig);
      if (!frameIndexes.length) {
        setSequenceLoadState((current) => ({ ...current, [skillMotion]: false }));
        return;
      }

      let completedCount = 0;
      let hasFailed = false;
      const markCompleted = () => {
        completedCount += 1;
        if (completedCount !== frameIndexes.length || !isMounted) return;

        setSequenceLoadState((current) => ({
          ...current,
          [skillMotion]: !hasFailed,
        }));
      };

      frameIndexes.forEach((frameIndex) => {
        const image = new window.Image();
        image.onload = markCompleted;
        image.onerror = () => {
          hasFailed = true;
          markCompleted();
        };
        image.src = getPngFrameSrc(sequenceConfig.folder, frameIndex);
        preloadedImages.push(image);
      });
    });

    return () => {
      isMounted = false;
      preloadedImages.length = 0;
    };
  }, []);

  const scheduleTimeout = (callback, delay) => {
    const timeoutId = window.setTimeout(() => {
      timeoutRefs.current = timeoutRefs.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  };

  const createActionEffect = (payload) => {
    actionEffectIdRef.current += 1;
    return {
      id: `${Date.now()}-${actionEffectIdRef.current}`,
      ...payload,
    };
  };

  const resetBattle = () => {
    setAttackSequence(null);
    setCounterSequence(null);
    setActionEffect(null);
    setIsResolving(false);
    setState(createInitialBattleState());
  };

  const clearBossReactionSoon = () => {
    scheduleTimeout(() => {
      setState((current) => ({ ...current, bossReaction: '' }));
    }, 360);
  };

  const startAttackSequence = (hero, damage, heroIndex, combo) => {
    const heroElement = heroCardRefs.current[heroIndex];
    const bossElement = bossCardRef.current;
    const partyElement = heroPartyRef.current;
    const viewportWidth = window.innerWidth || 430;
    const viewportHeight = window.innerHeight || 760;
    const id = `${hero.id}-${Date.now()}`;
    const motion = getHeroSkillMotion(hero);
    const from = getViewportRect(heroElement);
    const to = getViewportRect(bossElement);
    const party = getViewportRect(partyElement);
    const containerWidth = viewportWidth;
    const containerHeight = viewportHeight;
    const fallbackFrom = {
      x: 34,
      y: containerHeight - 190,
      width: 64,
      height: 86,
      centerX: 66,
      centerY: containerHeight - 147,
    };
    const fallbackTo = {
      x: containerWidth - 82,
      y: 18,
      width: 66,
      height: 86,
      centerX: containerWidth - 49,
      centerY: 61,
    };
    const fallbackParty = {
      x: 18,
      y: containerHeight - 160,
      width: containerWidth - 36,
      height: 92,
      centerX: containerWidth / 2,
      centerY: containerHeight - 114,
    };

    setAttackSequence({
      id,
      heroImage: hero.image,
      heroName: hero.name,
      motion,
      damage,
      combo,
      from: from || fallbackFrom,
      to: to || fallbackTo,
      party: party || fallbackParty,
      containerWidth,
      containerHeight,
      sourceHeroIndex: heroIndex,
      phase: 'dash',
    });

    scheduleTimeout(() => {
      setAttackSequence((current) => (
        current?.id === id ? { ...current, phase: 'impact' } : current
      ));
    }, reducedMotion ? 30 : 360);

    scheduleTimeout(() => {
      setAttackSequence((current) => (current?.id === id ? null : current));
    }, reducedMotion ? 220 : getSkillSequenceDuration(motion) + 60);
  };

  const startCounterSequence = () => {
    const bossElement = bossCardRef.current;
    const partyElement = heroPartyRef.current;
    const viewportWidth = window.innerWidth || 430;
    const viewportHeight = window.innerHeight || 760;
    const containerWidth = viewportWidth;
    const containerHeight = viewportHeight;
    const id = `boss-counter-${Date.now()}`;
    const from = getViewportRect(bossElement);
    const to = getViewportRect(partyElement);
    const fallbackFrom = {
      x: containerWidth - 82,
      y: 18,
      width: 66,
      height: 86,
      centerX: containerWidth - 49,
      centerY: 61,
    };
    const fallbackTo = {
      x: 18,
      y: containerHeight - 160,
      width: containerWidth - 36,
      height: 92,
      centerX: containerWidth / 2,
      centerY: containerHeight - 114,
    };

    setCounterSequence({
      id,
      bossImage: battle.boss.image,
      bossName: battle.boss.name,
      damage: COUNTER_DAMAGE,
      from: from || fallbackFrom,
      to: to || fallbackTo,
      containerWidth,
      containerHeight,
    });

    scheduleTimeout(() => {
      setCounterSequence((current) => (current?.id === id ? null : current));
    }, reducedMotion ? 220 : 620);
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
    if (state.battleStatus !== 'playing' || !currentQuestion || attackSequence || counterSequence || isResolving) return;

    const isCorrect = choice === currentQuestion.answer;
    setIsResolving(true);
    if (isCorrect) {
      const damage = activeHero.attack;
      const nextCombo = state.combo + 1;
      const effect = createActionEffect({
        type: 'hero_attack',
        heroId: activeHero.id,
        motion: getHeroSkillMotion(activeHero),
        damage,
      });
      playBattleSfx(effect.motion);
      startAttackSequence(activeHero, damage, state.activeHeroIndex, nextCombo);
      setActionEffect(effect);
      const nextBossHp = Math.max(0, state.bossHp - damage);
      const nextState = {
        ...state,
        bossHp: nextBossHp,
        combo: nextCombo,
        activeHeroIndex: (state.activeHeroIndex + 1) % battle.heroes.length,
        message: `Good! ${activeHero.name} の ${getHeroSkillName(activeHero)}！Boss に ${damage} ダメージ！`,
        bossReaction: 'is-hit',
      };

      if (nextBossHp <= 0) {
        setState(nextState);
        clearBossReactionSoon();
        scheduleTimeout(() => {
          setState({
            ...nextState,
            battleStatus: 'clear',
            message: '風の試練クリア！Boss カードを手に入れた！',
          });
          setIsResolving(false);
        }, reducedMotion ? 180 : 620);
        return;
      }

      setState(nextState);
      clearBossReactionSoon();
      scheduleTimeout(() => {
        setState(moveToNextQuestion(nextState));
        setIsResolving(false);
      }, reducedMotion ? 180 : 620);
      return;
    }

    const nextPlayerHp = Math.max(0, state.playerHp - COUNTER_DAMAGE);
    const effect = createActionEffect({
      type: 'boss_counter',
      damage: COUNTER_DAMAGE,
    });
    playBattleSfx('boss_counter');
    setActionEffect(effect);
    const nextState = {
      ...state,
      playerHp: nextPlayerHp,
      combo: 0,
      message: `Boss 縺ｮ蜿肴茶・￣layer HP -${COUNTER_DAMAGE}`,
      bossReaction: 'is-counter',
    };

    startCounterSequence();
    setState(nextState);

    scheduleTimeout(() => {
      if (nextPlayerHp <= 0) {
        setState({
          ...nextState,
          battleStatus: 'failed',
          message: FAILED_MESSAGE,
          bossReaction: '',
        });
        setIsResolving(false);
        return;
      }

      setState({
        ...moveToNextQuestion(nextState),
        bossReaction: '',
      });
      setIsResolving(false);
    }, reducedMotion ? 180 : 620);
  };

  const renderHeroParty = () => (
    <section
      ref={heroPartyRef}
      className={`eq-battle-hero-party ${counterSequence ? 'is-hit' : ''}`}
      aria-label="Hero party"
    >
      {battle.heroes.map((hero, index) => {
        const isActive = index === state.activeHeroIndex && state.battleStatus === 'playing';
        const isCharging = attackSequence?.sourceHeroIndex === index;

        return (
          <article
            key={hero.id}
            ref={(element) => {
              heroCardRefs.current[index] = element;
            }}
            className={`eq-battle-hero-card ${isActive ? 'is-active' : ''} ${isCharging ? 'is-charging' : ''}`}
          >
            {isActive || isCharging ? (
              <span className="eq-battle-hero-badge">攻撃中！</span>
            ) : null}
            <span className="eq-battle-hero-element">風</span>
            <img src={hero.image} alt={hero.name} />
          </article>
        );
      })}
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
      <div
        ref={battleRef}
        className={`eq-boss-battle-stage eq-battle-page-v2 ${attackSequence?.phase === 'impact' ? 'is-skill-impact' : ''} ${counterSequence ? 'is-counter-impact' : ''} ${attackSequence?.motion ? `is-skill-${attackSequence.motion}` : ''}`}
      >
      <div className="eq-battle-top-hud" aria-label="Battle HP status">
        <img
          src="/assets/eigo-quest/battle-ui/head-frame.png"
          alt=""
          className="eq-battle-top-hud-frame"
          aria-hidden="true"
        />

        <div className="eq-battle-top-hud-bars" aria-hidden="true">
          <div className="eq-battle-top-hud-bar eq-battle-top-hud-bar--left">
            <div
              className="eq-battle-top-hud-fill eq-battle-top-hud-fill--player"
              style={{ width: `${playerHpPercent}%` }}
            />
          </div>

          <div className="eq-battle-top-hud-bar eq-battle-top-hud-bar--right">
            <div
              className="eq-battle-top-hud-fill eq-battle-top-hud-fill--boss"
              style={{ width: `${bossHpPercent}%` }}
            />
          </div>
        </div>
      </div>

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
        <main className="eq-battle-arena">
          <section
            className={`eq-battle-boss-stage eq-battle-boss-zone ${state.bossReaction} ${counterSequence ? 'is-countering' : ''} ${attackSequence?.phase === 'impact' ? 'is-impact' : ''}`}
            style={bossHudStyle}
            aria-label="Boss card"
          >
            <div className="eq-battle-combo-panel">
              <span>COMBO</span>
              <motion.strong
                key={`combo-${state.combo}-${actionEffect?.id || 'idle'}`}
                initial={actionEffect?.type === 'hero_attack' && !reducedMotion
                  ? { scale: 1.48, color: '#fff1b8', textShadow: '0 0 18px rgba(255, 211, 90, 0.9)' }
                  : false}
                animate={{ scale: 1, color: '#ffd35a', textShadow: '0 0 12px rgba(255, 211, 90, 0.34)' }}
                transition={{ duration: reducedMotion ? 0.01 : 0.32, ease: 'easeOut' }}
              >
                {state.combo}
              </motion.strong>
              <div className="eq-battle-element-badge">
                <span aria-hidden="true">鬚ｨ</span>
                <small>WIND</small>
              </div>
            </div>

            <div className="eq-battle-boss-center">
              <img
                className="eq-battle-boss-magic-circle"
                src="/assets/eigo-quest/battle-ui/boss-magic-circle.png"
                alt=""
                aria-hidden="true"
              />
              <figure ref={bossCardRef} className="eq-battle-boss-card eq-battle-boss-card-wrap">
                <span className="eq-battle-boss-aura" aria-hidden="true" />
                <div className="eq-battle-boss-art-safe">
                  <img className="eq-battle-boss-art" src={battle.boss.image} alt={battle.boss.name} />
                </div>
                <figcaption>{battle.boss.name}</figcaption>
              </figure>
            </div>
          </section>

          <section className="eq-battle-quiz-stage">
          <section className={`eq-battle-question-frame eq-battle-speech-panel ${dialogueClass}`} aria-label="Battle question">
            <img
              className="eq-battle-dialogue-frame-img"
              src="/assets/eigo-quest/battle-ui/dialogue-frame.png"
              alt=""
              aria-hidden="true"
            />
            <div className="eq-battle-question-content eq-battle-speech-content">
            <p className={`eq-battle-question-text ${questionTextClass}`}>
              {currentQuestionText}
            </p>
            </div>
          </section>

          <div className="eq-battle-answer-grid">
            {(currentQuestion?.choices || []).map((choice, index) => (
              <EQChoiceButton
                key={`${currentQuestion.id}-${choice}`}
                badge={String.fromCharCode(65 + index)}
                className={`eq-battle-answer-button ${getAnswerTextClass(choice)}`}
                onClick={() => answerQuestion(choice)}
                disabled={Boolean(attackSequence || counterSequence || isResolving)}
              >
                {choice}
              </EQChoiceButton>
            ))}
          </div>
          </section>

          <section className="eq-battle-party-stage">
            <p className={`eq-boss-battle-message eq-battle-log is-${state.battleStatus} ${state.bossReaction}`} role="status">
              {state.message}
            </p>

            <div className={attackSequence?.motion === 'wind_blessing' ? 'eq-battle-hero-party-wrap is-blessed' : 'eq-battle-hero-party-wrap'}>
              {renderHeroParty()}
            </div>
          </section>
        </main>
      )}
      </div>
      <AnimatePresence>
        {attackSequence ? (
          <WindAttackOverlay
            key={attackSequence.id}
            sequence={attackSequence}
            reducedMotion={reducedMotion}
            sequenceLoadState={sequenceLoadState}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {counterSequence ? (
          <BossCounterOverlay
            key={counterSequence.id}
            sequence={counterSequence}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </AnimatePresence>
    </EQPageShell>
  );
}
