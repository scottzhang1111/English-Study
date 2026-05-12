import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import PetDisplay from '../components/PetDisplay';
import { getChildren, getHomeData } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const DEFAULT_HOME_DATA = {
  progress: 0,
  target: 20,
  remain: 20,
  total_words: 735,
  mastered_words: 0,
  study_days: 0,
  pet: {
    pokemon_id: 25,
    name: 'Pikachu',
    level: 1,
    exp: 0,
    max_exp: 100,
    total_exp: 0,
    image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
  },
};

const PARTNER_LINES = [
  'お疲れ様！よく頑張ったね！',
  '失敗しても大丈夫！次はきっとできるよ！',
  '君ならできる！自分を信じて！',
  '一歩ずつ進もう！応援してるよ！',
  '負けないで！キミの笑顔が一番だよ！',
  'ピッカ～！いっしょに頑張ろう！',
];

export default function HomePage() {
  const [data, setData] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [error, setError] = useState(null);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [partnerLineIndex, setPartnerLineIndex] = useState(0);
  const navigate = useNavigate();

  const dailyTrainingItems = [
    { label: '単語カード', subtitle: '読む・聞く・例文で覚える', status: `今日 ${data?.progress ?? 0}/${data?.target ?? 20}`, to: '/flashcard', icon: '読' },
    { label: 'クイズ練習', subtitle: '覚えた単語をチェック', status: '未開始', to: '/quiz', icon: '練' },
    { label: 'まちがい直し', subtitle: '苦手な問題をもう一度', status: '3問', to: '/review', icon: '復' },
  ];

  useEffect(() => {
    getChildren()
      .then((payload) => {
        const list = payload.children || [];
        setChildren(list);
        setChildrenLoaded(true);

        const stored = localStorage.getItem(CHILD_STORAGE_KEY);
        const hasStored = stored && list.some((child) => String(child.id) === stored);
        const initialId = hasStored ? stored : list[0]?.id ? String(list[0].id) : '';

        if (list.length === 0) {
          localStorage.removeItem(CHILD_STORAGE_KEY);
          navigate('/settings', { replace: true });
          return;
        }

        setSelectedChildId(initialId);
      })
      .catch((err) => {
        setError(err.message);
        setChildrenLoaded(true);
      });
  }, [navigate]);

  useEffect(() => {
    if (selectedChildId) {
      localStorage.setItem(CHILD_STORAGE_KEY, selectedChildId);
    }

    getHomeData(selectedChildId || undefined)
      .then(setData)
      .catch((err) => {
        setError(err.message);
        setData(DEFAULT_HOME_DATA);
      });
  }, [selectedChildId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPartnerLineIndex((index) => (index + 1) % PARTNER_LINES.length);
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedChild = useMemo(
    () => children.find((child) => String(child.id) === String(selectedChildId)) || null,
    [children, selectedChildId],
  );

  const progressWidth = data
    ? `${Math.min(100, (data.progress / Math.max(1, data.target)) * 100)}%`
    : '0%';
  const challengeLevel = selectedChild?.target_level || '準2級';

  if (childrenLoaded && children.length === 0 && !error) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-2 sm:px-6">
      <HeaderBar subtitle="キミと見つける、英語のちから！" />

      {error && (
        <div className="panel mb-4 px-5 py-4 text-sm font-semibold text-amber-800">
          API data is unavailable, so a preview home screen is shown. {error}
        </div>
      )}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel hero-panel relative overflow-hidden px-5 py-4 shadow-[0_18px_42px_rgba(112,158,203,0.14)] sm:px-6 sm:py-5"
        >
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(300px,0.72fr)]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full bg-white/75 px-4 py-2 text-sm font-bold text-[#566a90]">
                今日の学習
              </div>

              <div className="rounded-[24px] bg-white/80 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.08)]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-extrabold text-[#354172]">
                    {selectedChild ? selectedChild.name : '未登録'}
                  </p>
                  {selectedChild && (
                    <>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#61759e]">
                        学年 {selectedChild.grade}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#61759e]">
                        目標 {selectedChild.target_level}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate('/battle')}
                    className="pill-button px-8 py-4 text-[2rem] font-black text-[#4f3900] shadow-[0_12px_0_rgba(170,120,0,0.92),0_18px_30px_rgba(255,191,31,0.30)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.99]"
                  >
                    学習をはじめる
                  </button>
                  <p className="mt-3 text-[0.98rem] leading-6 text-[#44556f] sm:text-base">
                    今日の目標に向けて、単語をひとつずつ進めましょう。
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[18px] bg-white/78 px-3 py-3 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)]">
                    <div className="text-2xl font-bold text-[#354172]">{data?.total_words ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">総単語数</div>
                  </div>
                  <div className="rounded-[18px] bg-white/78 px-3 py-3 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)]">
                    <div className="text-2xl font-bold text-[#354172]">{data?.mastered_words ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">掌握単語</div>
                  </div>
                  <div className="rounded-[18px] bg-white/78 px-3 py-3 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)]">
                    <div className="text-2xl font-bold text-[#354172]">{data?.study_days ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">学習日数</div>
                  </div>
                </div>
              </div>

              {data && (
                <div className="rounded-[24px] bg-white/80 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.08)]">
                  <div className="flex items-center justify-between gap-4 text-sm font-bold text-[#5e7093]">
                    <span>今日の進み具合</span>
                    <span>
                      {data.progress} / {data.target}
                    </span>
                  </div>
                  <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-[#edf1f7] shadow-[inset_0_1px_3px_rgba(96,110,140,0.10)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#ffe65a,#ffb81f)] shadow-[0_0_12px_rgba(255,183,31,0.3)] transition-all duration-300"
                      style={{ width: progressWidth }}
                    />
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-[#4f627f]">
                    あと {data.remain} 語で今日の目標です。
                  </p>
                </div>
              )}
            </div>

            <div className="relative mx-auto flex w-full max-w-[340px] justify-center xl:pt-1">
              <PetDisplay
                pet={data?.pet}
                className="relative z-10 w-full"
                showDetails={false}
                enableEffects
                bubbleText={PARTNER_LINES[partnerLineIndex]}
              />
            </div>
          </div>
        </motion.section>

      <section className="mt-5">
        <div className="rounded-[30px] border border-white/80 bg-white/78 p-5 shadow-[0_12px_28px_rgba(145,177,209,0.10)]">
          <div>
            <p className="text-xs font-black text-[#8fa0c2]">学習メニュー</p>
            <h2 className="display-font mt-1 text-xl font-extrabold text-[#354172]">今日の学習メニュー</h2>
          </div>

          <div className="mt-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="display-font text-lg font-extrabold text-[#354172]">日常トレーニング</h3>
                <p className="mt-1 text-sm font-semibold text-[#6f7da8]">今日の単語を少しずつ進めよう</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dailyTrainingItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-center gap-3 rounded-[22px] border border-white/80 bg-[#f6fbff] px-4 py-3 text-[#354172] shadow-[0_8px_18px_rgba(145,177,209,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/88 active:scale-[1.02]"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white/82 text-lg font-black shadow-[inset_0_0_0_1px_rgba(132,173,222,0.18)]">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="display-font block text-base font-extrabold">{item.label}</span>
                    <span className="mt-0.5 block text-xs font-bold leading-5 text-[#6f7da8]">{item.subtitle}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-white/78 px-3 py-1 text-xs font-black text-[#6176aa]">
                    {item.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div>
              <h3 className="display-font text-lg font-extrabold text-[#354172]">本番チャレンジ</h3>
              <p className="mt-1 text-sm font-semibold text-[#6f7da8]">本番に近い形で、英検にチャレンジしよう</p>
            </div>

            <div className="mt-3 rounded-[26px] border border-[#c7e6d1] bg-[linear-gradient(135deg,#f2fbf5_0%,#e8f8ee_56%,#fff8d9_100%)] p-4 text-[#2f6445] shadow-[0_14px_30px_rgba(102,159,122,0.13)] sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-white/82 text-xl font-black shadow-[inset_0_0_0_1px_rgba(95,148,109,0.18)]">
                    AI
                  </div>
                  <div className="min-w-0">
                    <h3 className="display-font text-2xl font-extrabold text-[#2f6445]">英検AI特训</h3>
                    <p className="mt-1 text-sm font-bold leading-6 text-[#4f7a5f]">AI模擬問題で実力チェック</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[challengeLevel, '10問', '1問30秒', '捕獲チャンスあり'].map((tag) => (
                        <span key={tag} className="rounded-full bg-white/78 px-3 py-1 text-xs font-black text-[#3f7c5a]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <Link to="/battle" className="pill-button inline-flex items-center justify-center px-6 py-3 text-sm">
                  チャレンジする
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
