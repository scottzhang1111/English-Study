import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import { getLearnedWords } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function playAudio(text, audioRef) {
  if (!text) return;
  if (audioRef.current) {
    audioRef.current.pause();
  }
  const player = new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=en`);
  audioRef.current = player;
  player.play().catch(() => {});
}

export default function LearnedWordsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';

  useEffect(() => {
    getLearnedWords(childId)
      .then(setData)
      .catch((err) => setError(err.message));

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [childId]);

  const words = data?.words || [];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="単語カード" />

      {error && <div className="panel mb-4 px-5 py-5 text-sm text-rose-700">{error}</div>}

      <section className="panel overflow-hidden px-5 py-5 sm:px-7">
        <div className="mb-5 rounded-[28px] bg-[linear-gradient(180deg,#f8fbff_0%,#eef8ff_100%)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#6f7da8]">
                {data?.child?.name ? `${data.child.name} のカード` : '覚えた単語'}
              </p>
              <h2 className="display-font mt-1 text-3xl font-extrabold text-[#354172]">
                {words.length} words
              </h2>
            </div>
            <div className="rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-bold text-[#69557e]">
               mastered
            </div>
          </div>
        </div>

        {words.length === 0 ? (
          <div className="rounded-[28px] bg-[#f8fbff] px-6 py-10 text-center text-sm font-bold text-[#6f7da8]">
            まだ覚えた単語がありません。まず「学習をはじめる」から進めましょう。
          </div>
        ) : (
          <div className="grid gap-4">
            {words.map((item, index) => (
              <motion.article
                key={`${item.id}-${item.word}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.18) }}
                className="rounded-[30px] border border-white/80 bg-white/84 px-5 py-5 shadow-[0_12px_28px_rgba(145,177,209,0.10)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {item.importance && (
                        <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#6f7da8]">
                          重要度 {item.importance}
                        </span>
                      )}
                      <span className="rounded-full bg-[#fff7d6] px-3 py-1 text-xs font-black text-[#6b5a2d]">
                        mastery {item.mastery || 100}%
                      </span>
                    </div>

                    <h3 className="display-font truncate text-4xl font-extrabold text-[#354172]">
                      {item.word}
                    </h3>
                    <p className="mt-3 text-xl font-black text-[#6f7da8]">{item.jp}</p>
                    {item.cn && <p className="mt-2 text-sm font-bold text-[#6f7da8]">中文：{item.cn}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => playAudio(item.word, audioRef)}
                    className="pill-button shrink-0 px-5 py-3 text-sm font-black"
                  >
                    単語を聞く
                  </button>
                </div>

                <div className="mt-5 grid gap-3 text-sm font-bold text-[#60739e]">
                  {item.example && (
                    <div className="rounded-[24px] bg-[#f8fbff] px-4 py-3">
                      <p className="text-xs font-black text-[#94a2c5]">英語の例文</p>
                      <p className="mt-1 text-base text-[#51658a]">{item.example}</p>
                      <button
                        type="button"
                        onClick={() => playAudio(item.example, audioRef)}
                        className="mt-3 rounded-full border border-[#c9dcf3] bg-white px-4 py-2 text-xs font-black text-[#51658a]"
                      >
                        例文を聞く
                      </button>
                    </div>
                  )}

                  {item.example_jp && (
                    <div className="rounded-[24px] bg-[#f8fbff] px-4 py-3">
                      <p className="text-xs font-black text-[#94a2c5]">例文の意味</p>
                      <p className="mt-1 text-base text-[#51658a]">{item.example_jp}</p>
                    </div>
                  )}

                  {item.example_short && (
                    <div className="rounded-[24px] bg-[#f8fbff] px-4 py-3">
                      <p className="text-xs font-black text-[#94a2c5]">短い例文</p>
                      <p className="mt-1 text-base text-[#51658a]">{item.example_short}</p>
                    </div>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
