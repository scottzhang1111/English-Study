import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import { getChildStats } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function StatCard({ label, value }) {
  return (
    <div className="rounded-[24px] bg-white/82 p-5 text-center shadow-[0_12px_28px_rgba(145,177,209,0.10)]">
      <div className="text-3xl font-extrabold text-[#354172]">{value}</div>
      <div className="mt-2 text-sm font-bold text-[#6f7da8]">{label}</div>
    </div>
  );
}

export default function ChildStatsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(CHILD_STORAGE_KEY);
    getChildStats(stored || undefined)
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const selectedChild = data?.child || null;
  const today = data?.today || {};
  const topWrongWords = data?.top_wrong_words || [];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="学習統計" />

      {error ? (
        <div className="panel px-5 py-5 text-sm text-rose-700">{error}</div>
      ) : (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="panel px-6 py-6">
            <h2 className="display-font text-3xl font-extrabold text-[#354172]">子どもの学習状況</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f7da8]">
              {selectedChild
                ? `${selectedChild.name}（${selectedChild.grade} / ${selectedChild.target_level}）の学習状況です。`
                : 'まだ子どもが登録されていません。'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="今日は何語やったか" value={today.studied_count ?? 0} />
            <StatCard label="今日は何問正解したか" value={today.correct_count ?? 0} />
            <StatCard label="今日は何問まちがえたか" value={today.wrong_count ?? 0} />
            <StatCard label="合計で学習した単語数" value={data?.total_studied_words ?? 0} />
          </div>

          <div className="panel px-6 py-6">
            <h3 className="display-font text-2xl font-extrabold text-[#354172]">まちがいが多い単語 TOP 20</h3>
            <p className="mt-2 text-sm leading-6 text-[#6f7da8]">wrong_count の多い順で並べています。</p>

            {topWrongWords.length === 0 ? (
              <div className="mt-5 rounded-[24px] bg-white/70 p-6 text-center text-[#6f7da8]">
                まだ復習対象の単語はありません。
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {topWrongWords.map((item, index) => (
                  <div
                    key={`${item.vocab_id}-${index}`}
                    className="flex items-center justify-between gap-4 rounded-[22px] bg-white/80 px-5 py-4 shadow-[0_10px_24px_rgba(145,177,209,0.08)]"
                  >
                    <div className="min-w-0">
                      <p className="display-font truncate text-xl font-extrabold text-[#354172]">{item.word}</p>
                      <p className="mt-1 text-sm font-bold text-[#6f7da8]">{item.japanese}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end text-sm font-bold text-[#69557e]">
                      <span>まちがい {item.wrong_count}</span>
                      <span className="text-[#94a2c5]">くり返し {item.review_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}
