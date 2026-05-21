import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import './SpiritAssistant.css';

const SPIRIT_ASSET_BASE = '/assets/eigo-quest/spirit_assets/layered';

const DEFAULT_MESSAGES = [
  'ここは「風の国」だよ。',
  '風に乗って、新しい言葉を集めよう！',
  '次はクイズに挑戦してみよう！',
  'きっとできるよ、がんばって！',
];

const asset = (name) => `${SPIRIT_ASSET_BASE}/${name}`;

const SPIRIT_LAYERS = {
  body: asset('body_main.png'),
  faces: {
    idle: asset('face_normal.png'),
    normal: asset('face_normal.png'),
    smile: asset('face_happy.png'),
    talk: asset('face_happy.png'),
    happy: asset('face_happy.png'),
    sad: asset('face_sad.png'),
  },
  states: {
    idle: asset('idle_state.png'),
    normal: asset('idle_state.png'),
    smile: asset('talk_state.png'),
    talk: asset('talk_state.png'),
    happy: asset('happy_state.png'),
    sad: asset('idle_state.png'),
  },
  wings: asset('parts_wings.png'),
  orb: asset('parts_orb.png'),
  leafFx: asset('parts_leaf_fx.png'),
  faeFx: asset('parts_faefx.png'),
};

function SpiritImage({ src, alt = '', className = '', onMissing }) {
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable="false"
      onError={() => onMissing(src)}
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
  const faceSrc = SPIRIT_LAYERS.faces[activeMood] || SPIRIT_LAYERS.faces.idle;
  const fallbackSrc = SPIRIT_LAYERS.states[activeMood] || SPIRIT_LAYERS.states.idle;
  const canUseLayers = !failedAssets[SPIRIT_LAYERS.body] && !failedAssets[faceSrc];

  useEffect(() => {
    if (!reaction) return undefined;

    const timer = window.setTimeout(() => setReaction(null), 1500);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  function handleMissing(src) {
    setFailedAssets((current) => ({ ...current, [src]: true }));
  }

  function handleSpiritClick(event) {
    const nextReaction = Math.random() > 0.35 ? 'happy' : 'smile';
    const nextLine = Math.floor(Math.random() * safeMessages.length);

    setReaction(nextReaction);
    setLineIndex(nextLine);
    setSparkleBurst((value) => value + 1);
    onClick?.(event);
  }

  const rootStyle = typeof position === 'object' ? position : undefined;
  const positionClass = typeof position === 'string' ? `spirit-assistant--${position}` : 'spirit-assistant--custom';

  return (
    <aside className={`spirit-assistant ${positionClass}`} style={rootStyle} aria-label="精霊アシスタント">
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
        animate={reaction ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] } : { y: 0, rotate: 0 }}
        transition={{ duration: 0.42 }}
      >
        <motion.span
          className="spirit-assistant__float"
          animate={{ y: [0, -8, 0], scale: [1, 1.025, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {canUseLayers ? (
            <>
              <motion.span
                className="spirit-assistant__layer spirit-assistant__layer--fae"
                animate={{ opacity: [0.45, 0.85, 0.45], rotate: [0, 10, 0] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SpiritImage src={SPIRIT_LAYERS.faeFx} className="spirit-assistant__image" onMissing={handleMissing} />
              </motion.span>

              <motion.span
                className="spirit-assistant__layer spirit-assistant__layer--wings"
                animate={{ rotate: [-2, 3, -2], scale: [1, 1.03, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SpiritImage src={SPIRIT_LAYERS.wings} className="spirit-assistant__image" onMissing={handleMissing} />
              </motion.span>

              <SpiritImage
                src={SPIRIT_LAYERS.body}
                alt="精霊アシスタント"
                className="spirit-assistant__image spirit-assistant__image--body"
                onMissing={handleMissing}
              />

              <SpiritImage
                src={faceSrc}
                className="spirit-assistant__image spirit-assistant__layer spirit-assistant__layer--face"
                onMissing={handleMissing}
              />

              <motion.span
                className="spirit-assistant__layer spirit-assistant__layer--orb"
                animate={{ opacity: [0.72, 1, 0.72], scale: [0.96, 1.06, 0.96] }}
                transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SpiritImage src={SPIRIT_LAYERS.orb} className="spirit-assistant__image" onMissing={handleMissing} />
              </motion.span>

              <motion.span
                className="spirit-assistant__layer spirit-assistant__layer--leaf"
                animate={{ y: [0, -5, 0], rotate: [-4, 5, -4] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <SpiritImage src={SPIRIT_LAYERS.leafFx} className="spirit-assistant__image" onMissing={handleMissing} />
              </motion.span>
            </>
          ) : (
            <SpiritImage
              src={failedAssets[fallbackSrc] ? SPIRIT_LAYERS.states.idle : fallbackSrc}
              alt="精霊アシスタント"
              className="spirit-assistant__image spirit-assistant__image--full"
              onMissing={handleMissing}
            />
          )}

          <AnimatePresence>
            {reaction ? (
              <span key={sparkleBurst} className="spirit-assistant__sparkles" aria-hidden="true">
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
