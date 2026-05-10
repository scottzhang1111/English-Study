import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import { getBattleWrongQuestions, getReviewList, masterBattleWrongQuestion } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

export default function ReviewPage() {
  const [reviewList, setReviewList] = useState([]);
  const [battleWrongList, setBattleWrongList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
    setLoading(true);
    Promise.all([getReviewList(), getBattleWrongQuestions(childId)])
      .then(([reviewData, battleData]) => {
        setReviewList(reviewData.review_list || []);
        setBattleWrongList(battleData.wrongQuestions || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleMasterBattleWrong = (wrongId) => {
    masterBattleWrongQuestion(wrongId)
      .then(() => setBattleWrongList((items) => items.filter((item) => item.wrongId !== wrongId)))
      .catch((err) => setError(err.message));
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="復習リスト" />
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="panel px-6 py-6 sm:px-8">
        <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef8ff_0%,#e3f3ff_100%)] p-6">
          <h2 className="display-font text-3xl font-extrabold text-[#354172]">まちがえた問題を見なおそう</h2>
          <p className="mt-3 text-sm leading-6 text-[#6f7da8]">文法バトルと単語練習のまちがいを、やさしく復習できます。</p>
        </div>

        {loading ? (
          <div className="mt-5 rounded-[24px] bg-white/70 p-6 text-center text-[#6f7da8]">復習リストを読み込み中...</div>
        ) : error ? (
          <div className="mt-5 rounded-[24px] bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
        ) : reviewList.length === 0 && battleWrongList.length === 0 ? (
          <div className="mt-5 rounded-[24px] bg-white/70 p-6 text-center text-[#6f7da8]">まだ復習する問題はありません。</div>
        ) : (
          <div className="mt-5 space-y-4">
            {battleWrongList.length > 0 && (
              <section className="rounded-[28px] bg-[#eef8ff] p-4">
                <h3 className="display-font text-xl font-extrabold text-[#354172]">文法バトルのまちがい</h3>
                <p className="mt-1 text-sm font-bold text-[#6f7da8]">答えられたら「できた！」にしよう。少しEXPも入ります。</p>
                <div className="mt-4 space-y-3">
                  {battleWrongList.map((item) => (
                    <article key={item.wrongId} className="rounded-[24px] bg-white/88 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.10)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <span className="rounded-full bg-[#fff8d9] px-3 py-1 text-xs font-black text-[#6b5a2d]">{item.category}</span>
                          <p className="mt-3 text-base font-extrabold leading-7 text-[#354172]">{item.questionText}</p>
                          <p className="mt-2 text-sm font-bold text-[#6f7da8]">正解：{item.correctAnswer}</p>
                        </div>
                        <button type="button" onClick={() => handleMasterBattleWrong(item.wrongId)} className="pill-button shrink-0 px-4 py-2 text-sm">
                          できた！
                        </button>
                      </div>
                      <p className="mt-3 rounded-[20px] bg-[#fff8d9] px-4 py-3 text-sm font-bold leading-6 text-[#6b5a2d]">
                        {item.explanation || '解説はまだ準備中です。'}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {reviewList.map((item) => (
              <article key={item.word_id} className="rounded-[28px] bg-white/82 p-5 shadow-[0_16px_36px_rgba(145,177,209,0.12)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="display-font text-2xl font-extrabold text-[#354172]">{item.word}</p>
                    <p className="text-sm font-bold text-[#6f7da8]">{item.japanese}</p>
                    {item.id && <p className="mt-1 text-xs font-bold text-[#94a2c5]">ID: {item.id}</p>}
                  </div>
                  <div className="inline-flex rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-bold text-[#69557e]">
                    間違えた回数: {item.error_count}
                  </div>
                </div>
                {item.example_japanese && <p className="mt-4 leading-7 text-[#5d6d98]">例文: {item.example_japanese}</p>}
                {item.sentence_jp && <p className="mt-2 leading-7 text-[#5d6d98]">補足: {item.sentence_jp}</p>}
                <p className="mt-4 text-xs font-bold text-[#94a2c5]">最後に間違えた日: {item.last_error_date}</p>
              </article>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
