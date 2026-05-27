import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SpiritAssistant from '../eigo-quest/SpiritAssistant';
import eigoQuestWorlds from '../../config/eigoQuestWorlds';

const QUEST_STEPS = [
  { id: 'words', label: '単語学習', icon: 'book' },
  { id: 'quiz', label: '単語小テスト', icon: '?' },
  { id: 'grammar', label: '文法の神殿', icon: 'scroll' },
  { id: 'grammarTest', label: '文法テスト', icon: 'shield' },
  { id: 'reward', label: '英雄カード獲得', icon: 'chest' },
];

const STEP_INDEX = QUEST_STEPS.reduce((map, step, index) => ({ ...map, [step.id]: index }), {});

function QuestIcon({ icon }) {
  if (icon === 'book') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5.5c2.5-.8 4.4-.4 7 1.2v12c-2.6-1.6-4.5-2-7-1.2v-12Z" />
        <path d="M19 5.5c-2.5-.8-4.4-.4-7 1.2v12c2.6-1.6 4.5-2 7-1.2v-12Z" />
      </svg>
    );
  }
  if (icon === 'scroll') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5h10a2 2 0 0 1 0 4H8a2 2 0 0 0-2 2v7" />
        <path d="M7 19h10a2 2 0 0 0 0-4H8a2 2 0 0 1-2-2" />
        <path d="M9 11h7M9 14h5" />
      </svg>
    );
  }
  if (icon === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 19 6v5c0 4.5-2.8 7.7-7 10-4.2-2.3-7-5.5-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }
  if (icon === 'chest') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10h16v9H4v-9Z" />
        <path d="M5 10V7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5V10" />
        <path d="M10 13h4v3h-4z" />
      </svg>
    );
  }
  return <span aria-hidden="true">{icon}</span>;
}

export function QuestHeader({
  title,
  subtitle,
  backTo = '/app',
  backLabel = '戻る',
  className = '',
}) {
  const navigate = useNavigate();

  return (
    <header className={`quest-header ${className}`.trim()}>
      <button type="button" className="quest-back-button" onClick={() => navigate(backTo)} aria-label={backLabel}>
        <span aria-hidden="true">‹</span>
      </button>
      <div className="quest-header-copy">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <span className="quest-header-star" aria-hidden="true">✦</span>
    </header>
  );
}

export function QuestProgressStepper({
  current = 'words',
  completed = [],
  className = '',
}) {
  const currentIndex = STEP_INDEX[current] ?? 0;
  const completedSet = new Set(completed);

  return (
    <nav className={`quest-progress-stepper ${className}`.trim()} aria-label="クエスト進行">
      {QUEST_STEPS.map((step, index) => {
        const isCurrent = step.id === current;
        const isDone = completedSet.has(step.id) || index < currentIndex;
        return (
          <div
            key={step.id}
            className={`quest-step ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`.trim()}
          >
            <span className="quest-step-node">
              {isDone ? <span className="quest-step-check">✓</span> : <QuestIcon icon={step.icon} />}
            </span>
            <strong>{step.label}</strong>
          </div>
        );
      })}
    </nav>
  );
}

export function QuestPageLayout({
  title,
  subtitle,
  backTo = '/app',
  currentStep = 'words',
  completedSteps = [],
  progressLabel,
  children,
  className = '',
  showStepper = true,
}) {
  return (
    <main className={`quest-page-layout ${className}`.trim()}>
      <QuestHeader title={title} subtitle={subtitle} backTo={backTo} />
      <div className="quest-page-content">{children}</div>
      {progressLabel ? <div className="quest-flow-label">{progressLabel}</div> : null}
      {showStepper ? <QuestProgressStepper current={currentStep} completed={completedSteps} /> : null}
    </main>
  );
}

export function WorldMiniBanner({
  worldId = 'wind',
  day = 'Day 1',
  learned = 1,
  total = 5,
  className = '',
}) {
  const world = useMemo(
    () => eigoQuestWorlds.find((item) => item.id === worldId) || eigoQuestWorlds[0],
    [worldId],
  );

  return (
    <section className={`world-mini-banner ${className}`.trim()}>
      {world?.backgroundImage ? <img src={world.backgroundImage} alt="" loading="lazy" /> : null}
      <div className="world-mini-shade" aria-hidden="true" />
      <div className="world-mini-icon" aria-hidden="true">{world?.icon || '風'}</div>
      <div className="world-mini-copy">
        <h2>{world?.nameJa || '風の世界'}</h2>
        <p>{String(world?.id || 'wind').toUpperCase()} REALM</p>
        <div>
          <span>{day}</span>
          <strong>学習中の単語 <b>{learned}</b> / {total} words</strong>
        </div>
      </div>
    </section>
  );
}

export function SpiritGuide({
  worldName = '風の精霊',
  mood = 'idle',
  messages = ['まずは単語をおぼえよう！'],
  className = '',
}) {
  return (
    <div className={`spirit-guide ${className}`.trim()}>
      <SpiritAssistant worldName={worldName} mood={mood} messages={messages} position="quest" />
    </div>
  );
}

export function MagicPanel({ children, className = '', as: Component = motion.section, ...props }) {
  return (
    <Component className={`magic-panel ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}

export function GoldQuestButton({
  children,
  className = '',
  disabled = false,
  asLink = false,
  to,
  ...props
}) {
  const classes = `gold-quest-button ${className}`.trim();
  if (asLink && to) {
    return <Link to={to} className={classes}>{children}</Link>;
  }
  return (
    <motion.button
      type="button"
      className={classes}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function AudioButton({ children, className = '', tone = 'blue', ...props }) {
  return (
    <button type="button" className={`audio-quest-button is-${tone} ${className}`.trim()} {...props}>
      <span aria-hidden="true">▶</span>
      {children}
    </button>
  );
}

export { QUEST_STEPS };
