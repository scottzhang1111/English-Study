import { useState } from 'react';
import { motion } from 'framer-motion';
import { getEikenQuestions } from '../api';

export default function EggChallengeButton({ onQuestionsLoaded, isLoading = false }) {
  const [isShaking, setIsShaking] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading || isShaking) return;

    setIsShaking(true);
    setShowLoading(true);
    setTimeout(() => setIsShaking(false), 600);

    try {
      const data = await getEikenQuestions();
      setTimeout(() => {
        setShowLoading(false);
        onQuestionsLoaded?.(data.questions || []);
      }, 800);
    } catch (error) {
      console.error('Failed to load questions:', error);
      setShowLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {!showLoading ? (
        <motion.button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          whileTap={!isLoading ? { scale: 0.95 } : {}}
          className={`relative h-32 w-32 rounded-full bg-gradient-to-br from-[#ffd699] via-[#ffb84d] to-[#ff9900] shadow-xl transition-all duration-200 ${
            isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-2xl'
          }`}
          animate={isShaking ? { x: [-4, 4, -4, 4, 0] } : {}}
          transition={{ duration: 0.6 }}
        >
          <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-bold leading-tight text-amber-900">
            演習を開く
          </span>
        </motion.button>
      ) : (
        <motion.div
          className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-amber-100 text-center text-sm font-bold text-amber-700"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        >
          読み込み中...
        </motion.div>
      )}
    </div>
  );
}
