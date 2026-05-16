import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import PetDisplay from '../components/PetDisplay';
import { getChildren, getHomeData } from '../api';
import { getPartner } from '../utils/childStorage';

const DEFAULT_DAILY_WORD_TARGET = 20;
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

function clearSelectedChildId() {
  localStorage.removeItem(CHILD_STORAGE_KEY);
  try {
    sessionStorage.removeItem(CHILD_STORAGE_KEY);
  } catch (err) {
    // sessionStorage can be unavailable in restricted browser modes.
  }
}

export default function HomePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [partnerLineIndex, setPartnerLineIndex] = useState(0);
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem(CHILD_STORAGE_KEY) || '');
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [hasNoChildren, setHasNoChildren] = useState(false);
  const navigate = useNavigate();
  const todayTarget = Number(data?.target || selectedChild?.daily_target || DEFAULT_DAILY_WORD_TARGET);
  const todayStudied = Number(data?.progress ?? 0);
  const safeTodayTarget = Math.max(1, todayTarget);
  const isDailyComplete = todayStudied === safeTodayTarget;
  const isDailyOverComplete = todayStudied > safeTodayTarget;
  const bonusCount = Math.max(0, todayStudied - safeTodayTarget);
  const dailyTitle = isDailyOverComplete || isDailyComplete ? '今日の目標クリア！' : '今日の学習';
  const dailyButtonText = isDailyOverComplete
    ? 'ボーナスチャレンジ'
    : isDailyComplete
      ? '今日の学習を見る'
      : todayStudied > 0
        ? 'つづきから'
        : '学習をはじめる';
  const dailyStatusText = isDailyOverComplete
    ? `${todayStudied}問 達成`
    : isDailyComplete
      ? '目標クリア'
      : `${todayStudied} / ${safeTodayTarget}`;
  const dailyDetailText = isDailyOverComplete
    ? `目標 ${safeTodayTarget}問 + ボーナス${bonusCount}問`
    : isDailyComplete
      ? `${safeTodayTarget}問 達成`
      : `あと ${Math.max(0, safeTodayTarget - todayStudied)} 語で今日の目標です。`;
  const dailyMessage = isDailyOverComplete
    ? 'すごい！今日はもう十分がんばりました。'
    : isDailyComplete
      ? '今日の目標を達成しました。よくがんばりました。'
      : '今日の目標に向けて、単語をひとつずつ進めましょう。';
  const petBubbleText = isDailyOverComplete ? 'すごすぎる！でも休憩も大事だよ！' : PARTNER_LINES[partnerLineIndex];

  const dailyTrainingItems = [
    { label: '単語カード', subtitle: '読む・聞く・例文で覚える', status: isDailyOverComplete ? `目標クリア +${bonusCount}` : `今日 ${todayStudied}/${safeTodayTarget}`, to: '/flashcard', icon: '読' },
    { label: 'クイズ練習', subtitle: '覚えた単語をチェック', status: '未開始', to: '/quiz', icon: '練' },
    { label: 'Word Web', subtitle: 'Synonym / antonym practice', status: '1500 words', to: '/vocab-expansion', icon: 'W' },
    { label: 'まちがい直し', subtitle: '苦手な問題をもう一度', status: '3問', to: '/review', icon: '復' },
  ];

  useEffect(() => {
    let cancelled = false;
    getChildren()
      .then((payload) => {
        if (cancelled) return;
        const childList = payload.children || [];
        setChildrenLoaded(true);
        if (childList.length === 0) {
          clearSelectedChildId();
          setSelectedChildId('');
          setSelectedChild(null);
          setHasNoChildren(true);
          setData(null);
          return;
        }
        setHasNoChildren(false);
        if (!selectedChildId) {
          navigate('/settings/children', { replace: true });
          return;
        }
        const child = childList.find((item) => String(item.id) === String(selectedChildId));
        if (!child) {
          clearSelectedChildId();
          setSelectedChildId('');
          navigate('/settings/children', { replace: true });
          return;
        }
        setSelectedChild(child);
      })
      .catch((err) => {
        setChildrenLoaded(true);
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, selectedChildId]);

  useEffect(() => {
    if (!selectedChildId || hasNoChildren) return;
    getHomeData(selectedChildId)
      .then(setData)
      .catch((err) => {
        setError(err.message);
        setData(DEFAULT_HOME_DATA);
      });
  }, [hasNoChildren, selectedChildId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPartnerLineIndex((index) => (index + 1) % PARTNER_LINES.length);
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);

  const progressWidth = data
    ? `${Math.min(100, (todayStudied / safeTodayTarget) * 100)}%`
    : '0%';
  const challengeLevel = selectedChild?.targetLevel || '準2級';
  const partner = selectedChild ? getPartner(selectedChild.partnerMonsterId) : null;

  if (!childrenLoaded) {
    return null;
  }

  if (hasNoChildren) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        <HeaderBar subtitle="キミと見つける、英語のちから！" />
        <section className="panel px-6 py-10 text-center sm:px-10">
          <h1 className="display-font text-3xl font-extrabold text-[#354172]">子どもが登録されていません</h1>
          <p className="mt-3 text-sm font-bold text-[#6f7da8]">今日の学習を始めるには、子どもを追加してください。</p>
          <button type="button" onClick={() => navigate('/settings/children')} className="pill-button mt-7 px-7 py-4 text-base">
            子どもを追加する
          </button>
        </section>
      </div>
    );
  }

  if (!selectedChild) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-2 sm:px-6">
      <HeaderBar subtitle="キミと見つける、英語のちから！" />

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
                    {selectedChild.name} さん
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#61759e]">
                    学年：{selectedChild.grade}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#61759e]">
                    目標：{selectedChild.targetLevel}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/select-child')}
                    className="rounded-full bg-[#fff7d6] px-3 py-1 text-xs font-black text-[#6b5a2d]"
                  >
                    切り替え
                  </button>
                </div>
                {partner && <p className="mt-2 text-xs font-bold text-[#6f7da8]">パートナー：{partner.name} Lv.1</p>}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                <div className="min-w-0">
                  <h1 className="display-font mb-3 text-3xl font-extrabold text-[#354172]">
                    {dailyTitle}
                  </h1>
                  <button
                    type="button"
                    onClick={() => navigate('/daily-words')}
                    className="pill-button px-8 py-4 text-[2rem] font-black text-[#4f3900] shadow-[0_12px_0_rgba(170,120,0,0.92),0_18px_30px_rgba(255,191,31,0.30)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.99]"
                  >
                    {dailyButtonText}
                  </button>
                  {isDailyOverComplete && (
                    <button
                      type="button"
                      onClick={() => navigate('/petroom')}
                      className="ghost-button ml-0 mt-3 px-6 py-3 text-sm sm:ml-3 sm:mt-0"
                    >
                      ペットを見る
                    </button>
                  )}
                  <p className="mt-3 text-[0.98rem] leading-6 text-[#44556f] sm:text-base">
                    {dailyMessage}
                  </p>
                  {isDailyOverComplete && (
                    <p className="mt-2 text-sm font-bold text-[#6f7da8]">つづける時は、少し休んでからね。</p>
                  )}
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
                    <span>{dailyStatusText}</span>
                  </div>
                  <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-[#edf1f7] shadow-[inset_0_1px_3px_rgba(96,110,140,0.10)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#ffe65a,#ffb81f)] shadow-[0_0_12px_rgba(255,183,31,0.3)] transition-all duration-300"
                      style={{ width: progressWidth }}
                    />
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-[#4f627f]">
                    {dailyDetailText}
                  </p>
                  {isDailyOverComplete && (
                    <p className="mt-1.5 text-xs font-black text-[#b07a00]">目標クリア</p>
                  )}
                </div>
              )}
            </div>

            <div className="relative mx-auto flex w-full max-w-[340px] justify-center xl:pt-1">
              <PetDisplay
                pet={data?.pet}
                className="relative z-10 w-full"
                showDetails={false}
                enableEffects
                bubbleText={petBubbleText}
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
