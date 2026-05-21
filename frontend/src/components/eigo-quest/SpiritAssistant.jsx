import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import './SpiritAssistant.css';

const SPIRIT_ASSET_BASE = '/assets/eigo-quest/spirit_assets';

const DEFAULT_MESSAGES = [
  'ここは「風の国」だよ。',
  '風に乗って、新しい言葉を集めよう！',
  '次はクイズに挑戦してみよう！',
  'きっとできるよ、がんばって！',
];

const asset = (name) => `${SPIRIT_ASSET_BASE}/${name}`;

const SPIRIT_STATES = {
  idle: asset('idle.png'),
  normal: asset('idle.png'),
  talk: asset('talk.png'),
  happy: asset('happy.png'),
  smile: asset('happy.png'),
  sad: asset('sad.png'),
  comfort: asset('sad.png'),
  dance: asset('dance.png'),
};

function SpiritImage({ src, alt = '', className = '', onMissing }) {
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable="false"
      onError={() => onMissing?.(src)}
    />
  );
}

export default function SpiritAssistant({
  worldName = '風の国',
  mood = 'normal',
  messages = DEFAULT_MESSAGES,
  position = 'home',
  onClick,
}) {
  const safeMessages = messages?.length ? messages : DEFAULT_MESSAGES;
  const [failedAssets, setFailedAssets] = useState({});
  const [lineIndex, setLineIndex] = useState(0);
  const [reaction, setReaction] = useState(null);
  const [sparkleBurst, setSparkleBurst] = useState(0);

  const activeMood = reaction || mood || 'idle';
  const spiritSrc = SPIRIT_STATES[activeMood] || SPIRIT_STATES.idle;

  useEffect(() => {
    if (!reaction) return undefined;

    const timer = window.setTimeout(() => setReaction(null), 1600);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  function handleMissing(src) {
    setFailedAssets((current) => ({ ...current, [src]: true }));
  }

  function handleSpiritClick(event) {
    const nextReaction = Math.random() > 0.5 ? 'happy' : 'dance';
    const nextLine = Math.floor(Math.random() * safeMessages.length);

    setReaction(nextReaction);
    setLineIndex(nextLine);
    setSparkleBurst((value) => value + 1);
    onClick?.(event);
  }

  const rootStyle = typeof position === 'object' ? position : undefined;
  const positionClass =
    typeof position === 'string'
      ? `spirit-assistant--${position}`
      : 'spirit-assistant--custom';

  return (
    <aside
      className={`spirit-assistant ${positionClass}`}
      style={rootStyle}
      aria-label="精霊アシスタント"
    >
      <motion.div
        className="spirit-assistant__bubble"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28 }}
      >
        <span>{worldName}</span>
        <p>{safeMessages[lineIndex]}</p>
      </motion.div>

      <motion.button
        type="button"
        className="spirit-assistant__button"
        aria-label="精霊に話しかける"
        onClick={handleSpiritClick}
        whileTap={{ scale: 0.92 }}
        animate={
          reaction
            ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] }
            : { y: 0, rotate: 0 }
        }
        transition={{ duration: 0.42 }}
      >
        <motion.span
          className="spirit-assistant__float"
          animate={{ y: [0, -8, 0], scale: [1, 1.025, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <SpiritImage
            src={failedAssets[spiritSrc] ? SPIRIT_STATES.idle : spiritSrc}
            alt="精霊アシスタント"
            className="spirit-assistant__image spirit-assistant__image--full"
            onMissing={handleMissing}
          />

          <AnimatePresence>
            {reaction ? (
              <span
                key={sparkleBurst}
                className="spirit-assistant__sparkles"
                aria-hidden="true"
              >
                {[0, 1, 2, 3, 4].map((sparkle) => (
                  <motion.i
                    key={sparkle}
                    initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0.4, 1, 0.8],
                      x: [0, (sparkle - 2) * 15],
                      y: [0, -24 - sparkle * 5],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.75, delay: sparkle * 0.04 }}
                  />
                ))}
              </span>
            ) : null}
          </AnimatePresence>
        </motion.span>
      </motion.button>
    </aside>
  );
}