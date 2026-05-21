import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import './SpiritAssistant.css';

const SPIRIT_ASSET_BASE = '/assets/eigo-quest/spirit_assets';

const DEFAULT_MESSAGES = [
  'ここは「風の国」だよ。',
  '風に乗って、新しい言葉を集めよう！',
  '次はクイズに挑戦してみよう！',
  'きっとできるよ、がんばって！',
];

const asset = (name) => `${SPIRIT_ASSET_BASE}/${name}`;

const SPIRIT_ASSETS = {
  body: asset('body_main.png'),
  faces: {
    normal: asset('face_normal.png'),
    happy: asset('face_happy.png'),
    sad: asset('face_sad.png'),
    surprised: asset('face_surprised.png'),
    thinking: asset('face_thinking.png'),
    angry: asset('face_angry.png'),
    shy: asset('face_shy.png'),
  },
  states: {
    normal: asset('idle_state.png'),
    idle: asset('idle_state.png'),
    happy: asset('happy_state.png'),
    sad: asset('sad_state.png'),
    talk: asset('talk_state.png'),
    surprised: asset('happy_state.png'),
    thinking: asset('talk_state.png'),
  },
  wings: [asset('parts_wing.png'), asset('parts_wings.png')],
  leaves: [asset('parts_leaf.png'), asset('parts_leaf_fx.png')],
  faeFx: asset('parts_faefx.png'),
  orb: asset('parts_orb.png'),
};

const moodToFace = {
  normal: 'normal',
  happy: 'happy',
  sad: 'sad',
  surprised: 'surprised',
  thinking: 'thinking',
  angry: 'angry',
  shy: 'shy',
};

function firstWorkingAsset(candidates, failedAssets) {
  return candidates.find((src) => src && !failedAssets[src]);
}

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
  const [isBlinking, setIsBlinking] = useState(false);

  const activeMood = reaction || mood || 'normal';
  const faceKey = moodToFace[activeMood] || 'normal';
  const faceSrc = SPIRIT_ASSETS.faces[faceKey];
  const bodyMissing = failedAssets[SPIRIT_ASSETS.body];
  const faceMissing = failedAssets[faceSrc];
  const layeredMode = !bodyMissing;

  const completeStateSrc = useMemo(() => {
    const preferred = SPIRIT_ASSETS.states[activeMood] || SPIRIT_ASSETS.states.normal;
    return firstWorkingAsset(
      [preferred, SPIRIT_ASSETS.states.normal, SPIRIT_ASSETS.states.happy, SPIRIT_ASSETS.states.talk],
      failedAssets,
    );
  }, [activeMood, failedAssets]);

  const wingSrc = firstWorkingAsset(SPIRIT_ASSETS.wings, failedAssets);
  const leafSrc = firstWorkingAsset(SPIRIT_ASSETS.leaves, failedAssets);
  const faeFxSrc = failedAssets[SPIRIT_ASSETS.faeFx] ? null : SPIRIT_ASSETS.faeFx;
  const orbSrc = failedAssets[SPIRIT_ASSETS.orb] ? null : SPIRIT_ASSETS.orb;

  useEffect(() => {
    const blinkTimer = window.setInterval(() => {
      if (!layeredMode || faceMissing) return;

      setIsBlinking(true);
      window.setTimeout(() => setIsBlinking(false), 140);
    }, 3800);

    return () => window.clearInterval(blinkTimer);
  }, [faceMissing, layeredMode]);

  useEffect(() => {
    if (!reaction) return undefined;

    const timer = window.setTimeout(() => setReaction(null), 1500);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  function handleMissing(src) {
    setFailedAssets((current) => ({ ...current, [src]: true }));
  }

  function handleSpiritClick(event) {
    const nextReaction = Math.random() > 0.35 ? 'happy' : 'surprised';
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
          {faeFxSrc ? (
            <motion.span
              className="spirit-assistant__fx spirit-assistant__fx--halo"
              animate={{ opacity: [0.32, 0.72, 0.32], rotate: [0, 8, 0] }}
              transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <SpiritImage src={faeFxSrc} className="spirit-assistant__image" onMissing={handleMissing} />
            </motion.span>
          ) : null}

          {wingSrc ? (
            <motion.span
              className="spirit-assistant__layer spirit-assistant__layer--wings"
              animate={{ rotate: [-2, 3, -2], scale: [1, 1.03, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <SpiritImage src={wingSrc} className="spirit-assistant__image" onMissing={handleMissing} />
            </motion.span>
          ) : null}

          {layeredMode ? (
            <>
              <SpiritImage
                src={SPIRIT_ASSETS.body}
                alt="精霊アシスタント"
                className="spirit-assistant__image spirit-assistant__image--body"
                onMissing={handleMissing}
              />
              {!faceMissing ? (
                <motion.span
                  className="spirit-assistant__layer spirit-assistant__layer--face"
                  animate={isBlinking ? { scaleY: [1, 0.08, 1] } : { scaleY: 1 }}
                  transition={{ duration: 0.14 }}
                >
                  <SpiritImage src={faceSrc} className="spirit-assistant__image" onMissing={handleMissing} />
                </motion.span>
              ) : null}
            </>
          ) : completeStateSrc ? (
            <SpiritImage
              src={completeStateSrc}
              alt="精霊アシスタント"
              className="spirit-assistant__image spirit-assistant__image--state"
              onMissing={handleMissing}
            />
          ) : (
            <span className="spirit-assistant__fallback" aria-hidden="true">フィー</span>
          )}

          {leafSrc ? (
            <motion.span
              className="spirit-assistant__layer spirit-assistant__layer--leaf"
              animate={{ y: [0, -5, 0], rotate: [-8, 10, -8] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <SpiritImage src={leafSrc} className="spirit-assistant__image" onMissing={handleMissing} />
            </motion.span>
          ) : null}

          {orbSrc ? (
            <motion.span
              className="spirit-assistant__layer spirit-assistant__layer--orb"
              animate={{ opacity: [0.55, 1, 0.55], scale: [0.92, 1.08, 0.92] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
            >
              <SpiritImage src={orbSrc} className="spirit-assistant__image" onMissing={handleMissing} />
            </motion.span>
          ) : null}

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
