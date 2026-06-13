import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import WebLearningLayout from '../components/WebLearningLayout';
import { EQBottomNav } from '../components/eigo';
import { getEiken3Sets } from '../api';

export default function Eiken3SetListPage() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getEiken3Sets()
      .then((payload) => {
        if (!active) return;
        setSets(payload.sets || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || '英検3級セットを読み込めませんでした。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <WebLearningLayout title="英検3級 模擬テスト" subtitle="G3SET01〜G3SET10">
        <section className="panel p-5 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8fa0c2]">EIKEN GRADE 3</p>
              <h1 className="display-font mt-2 text-3xl font-black text-[#354172]">英検3級 模擬テスト</h1>
              <p className="mt-2 text-sm font-bold leading-6 text-[#60709d]">
                セットを選んで、30問の選択問題とライティング練習に挑戦しましょう。
              </p>
            </div>
            <Link to="/eiken" className="ghost-button inline-flex justify-center px-5 py-3 text-sm">
              英検メニューへ
            </Link>
          </div>
        </section>

        {error && <div className="mt-4 rounded-[22px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        {loading ? (
          <div className="mt-5 rounded-[24px] bg-white/76 p-6 text-center font-bold text-[#6f7da8]">準備しています...</div>
        ) : (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sets.map((item) => (
              <Link
                key={item.set_id}
                to={`/eiken3/quiz/${encodeURIComponent(item.set_id)}`}
                className="rounded-[26px] border border-white/80 bg-white/86 p-5 text-[#354172] shadow-[0_16px_36px_rgba(129,164,199,0.13)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8fa0c2]">Mock Set</p>
                <h2 className="mt-2 text-2xl font-black">{item.set_id}</h2>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
                  <span className="rounded-2xl bg-[#eef8ff] px-2 py-2 text-[#52668c]">{item.question_count}問</span>
                  <span className="rounded-2xl bg-[#fff7d6] px-2 py-2 text-[#75622c]">本文 {item.passage_count}</span>
                  <span className="rounded-2xl bg-[#eefbf1] px-2 py-2 text-[#2f6b42]">Writing {item.writing_count}</span>
                </div>
                <span className="pill-button mt-5 inline-flex w-full justify-center px-5 py-3 text-sm">開始する</span>
              </Link>
            ))}
          </section>
        )}
      </WebLearningLayout>
      <EQBottomNav />
    </>
  );
}
