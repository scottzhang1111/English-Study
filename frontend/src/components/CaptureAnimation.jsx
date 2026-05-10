import { motion } from 'framer-motion';

export default function CaptureAnimation({ monster, phase = 'idle', result = null }) {
  const isThrowing = phase === 'throwing' || phase === 'shake' || phase === 'done';
  const monsterHidden = phase === 'shake' || (phase === 'done' && result === 'success');

  return (
    <div className="relative mx-auto flex h-72 max-w-sm items-center justify-center overflow-hidden rounded-[34px] bg-[radial-gradient(circle_at_50%_36%,#fff9d8_0%,#edf9ff_58%,#dcefff_100%)]">
      <motion.div
        animate={{ scale: monsterHidden ? 0 : 1, opacity: monsterHidden ? 0 : 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="absolute top-8 flex h-36 w-36 items-center justify-center"
      >
        {monster?.imageUrl ? (
          <img
            src={monster.imageUrl}
            alt={monster.nameJa || 'monster'}
            className="h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(74,98,135,0.22)]"
          />
        ) : (
          <span className="text-5xl font-black text-[#9aa8c7]">?</span>
        )}
      </motion.div>

      {phase === 'shake' && (
        <motion.div
          initial={{ scale: 0.2, opacity: 0.75 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.52, ease: 'easeOut' }}
          className="absolute top-16 h-24 w-24 rounded-full bg-white"
        />
      )}

      {result === 'success' && phase === 'done' && (
        <div className="absolute inset-0 pointer-events-none">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, scale: 0.3, y: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.1, 0.6], y: -38 }}
              transition={{ delay: index * 0.08, duration: 1.0, repeat: Infinity, repeatDelay: 0.8 }}
              className="absolute text-2xl"
              style={{ left: `${22 + index * 11}%`, top: `${44 + (index % 2) * 10}%` }}
            >
              ★
            </motion.span>
          ))}
        </div>
      )}

      <motion.div
        initial={false}
        animate={
          phase === 'throwing'
            ? { x: [0, -20, 14], y: [96, -38, -88], scale: [1, 0.72, 0.5], rotate: [0, -12, 8] }
            : phase === 'shake'
              ? { x: 0, y: 72, scale: 0.76, rotate: [-15, 15, -10, 10, 0] }
              : { x: 0, y: isThrowing ? 72 : 104, scale: isThrowing ? 0.76 : 1, rotate: 0 }
        }
        transition={
          phase === 'shake'
            ? { duration: 1.1, ease: 'easeInOut' }
            : { duration: 0.75, ease: 'easeOut' }
        }
        className="absolute flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-[#405071] bg-[linear-gradient(180deg,#ff6f8d_0_48%,#ffffff_49%_100%)] shadow-[0_14px_24px_rgba(69,88,121,0.22)]"
      >
        <span className="h-5 w-5 rounded-full border-[4px] border-[#405071] bg-white" />
      </motion.div>
    </div>
  );
}
