import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import PetDisplay from '../components/PetDisplay';
import { getGrammarLessons, getHomeData } from '../api';
import { useChildren } from '../ChildrenContext';
import { getPartner } from '../utils/childStorage';

const DEFAULT_DAILY_WORD_TARGET = 20;
const DEFAULT_HOME_DATA = {
  progress: 0,
  target: 20,
  remain: 20,
  total_words: 735,
  mastered_words: 0,
  study_days: 0,
  pet: {
    pokemon_id: 1,
    name: 'そらうさぎ',
    level: 1,
    exp: 0,
    max_exp: 100,
    total_exp: 0,
    image_url: '/assets/pets/air/AIR_RABBIT1.png',
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
  const [grammarData, setGrammarData] = useState(null);
  const [error, setError] = useState(null);
  const [partnerLineIndex, setPartnerLineIndex] = useState(0);
  const [hasNoChildren, setHasNoChildren] = useState(false);
  const { children, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();
  const navigate = useNavigate();
  const selectedChild = useMemo(
    () => children.find((item) => String(item.id) === String(selectedChildId)) || null,
    [children, selectedChildId],
  );
  const todayTarget = Number(data?.target || selectedChild?.daily_target || DEFAULT_DAILY_WORD_TARGET);
  const todayStudied = Number(data?.progress ?? 0);
  const safeTodayTarget = Math.max(1, todayTarget);
  const isDailyComplete = todayStudied === safeTodayTarget;
  const isDailyOverComplete = todayStudied > safeTodayTarget;
  const bonusCount = Math.max(0, todayStudied - safeTodayTarget);
  const todayGrammarLesson = grammarData?.todayLesson || null;
  const grammarStats = grammarData?.stats || {};
  const grammarProgress = todayGrammarLesson?.progress || {};
  const grammarQuizTotal = Number(grammarProgress.totalQuizCount || todayGrammarLesson?.quizCount || 0);
  const grammarQuizDone = Number(grammarProgress.correctQuizCount || 0);
  const isGrammarComplete = grammarProgress.status === 'mastered';
  const grammarStatusText = isGrammarComplete
    ? '今日の文法クリア'
    : grammarProgress.status === 'learning'
      ? `${grammarQuizDone} / ${grammarQuizTotal || '-'} 問`
      : '未開始';
  const grammarButtonText = isGrammarComplete ? '次の文法を見る' : grammarProgress.status === 'learning' ? 'つづきから' : '文法を学ぶ';
  const dailyTitle = isDailyOverComplete || isDailyComplete ? '今日の目標クリア！' : '今日の学習';
  const dailyButtonText = isDailyOverComplete
    ? 'ボーナスチャレンジ'
    : isDailyComplete
      ? '新しい単語へ'
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
      ? '今日の目標を達成しました。新しい単語にも進めます。'
      : '今日の目標に向けて、単語をひとつずつ進めましょう。';
  const petBubbleText = isDailyOverComplete ? 'すごすぎる！でも休憩も大事だよ！' : PARTNER_LINES[partnerLineIndex];

  const dailyTrainingItems = [
    {
      label: '単語カード',
      subtitle: '読む・聞く・例文で覚える',
      status: isDailyOverComplete ? `目標クリア +${bonusCount}` : isDailyComplete ? '目標クリア' : `今日 ${todayStudied}/${safeTodayTarget}`,
      to: '/flashcard',
      icon: '読',
    },
    { label: 'クイズ練習', subtitle: '覚えた単語をチェック', status: '未開始', to: '/quiz', icon: '練' },
    { label: '類義語・対義語', subtitle: '似た言葉・反対の言葉をチェック', status: '1500 words', to: '/vocab-expansion', icon: '網' },
    { label: 'まちがい直し', subtitle: '苦手な問題をもう一度', status: '3問', to: '/review', icon: '復' },
    { label: '文法練習', subtitle: '学んだ文法から5問', status: 'ランダム', to: '/grammar-practice', icon: '文' },
    { label: '英検チャレンジ', subtitle: '準2級のもぎテストに挑戦しよう', status: '模擬テスト', to: '/eiken-pre2', icon: '英' },
    { label: '英検真題', subtitle: '過去問とリスニング音声で練習', status: '音声つき', to: '/eiken-real', icon: '真' },
  ];

  useEffect(() => {
    if (childrenLoading) return;
    if (children.length === 0) {
      setSelectedChildId('');
      setHasNoChildren(true);
      setData(null);
      return;
    }
    setHasNoChildren(false);
    if (!selectedChildId) {
      navigate('/settings/children', { replace: true });
      return;
    }
    const child = children.find((item) => String(item.id) === String(selectedChildId));
    if (!child) {
      setSelectedChildId('');
      navigate('/settings/children', { replace: true });
      return;
    }
  }, [children, childrenLoading, navigate, selectedChildId, setSelectedChildId]);

  useEffect(() => {
    if (!selectedChildId || hasNoChildren) return;
    Promise.all([
      getHomeData(selectedChildId),
      getGrammarLessons(selectedChildId).catch(() => null),
    ])
      .then(([homePayload, grammarPayload]) => {
        setData(homePayload);
        setGrammarData(grammarPayload);
      })
      .catch((err) => {
        setError(err.message);
        setData(DEFAULT_HOME_DATA);
        setGrammarData(null);
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
  const partner = selectedChild ? getPartner(selectedChild.partnerMonsterId) : null;

  if (childrenLoading) {
    return null;
  }

  if (childrenError) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        <HeaderBar subtitle="キミと見つける、英語のちから！" />
        <section className="panel px-6 py-10 text-center sm:px-10">
          <h1 className="display-font text-3xl font-extrabold text-[#354172]">読み込みに失敗しました</h1>
          <p className="mt-3 text-sm font-bold text-rose-700">{childrenError}</p>
          <button type="button" onClick={refreshChildren} className="pill-button mt-7 px-7 py-4 text-base">
            Retry
          </button>
        </section>
      </div>
    );
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
    return <Navigate replace to="/settings/children" />;
  }

  return (
    <div className="mx-auto max-w-7xl overflow-x-hidden px-3 pb-28 pt-2 sm:px-6 md:pb-10">
      <HeaderBar subtitle="キミと見つける、英語のちから！" />

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel hero-panel relative overflow-hidden px-4 py-4 shadow-[0_18px_42px_rgba(112,158,203,0.14)] md:px-6 md:py-5"
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
                  <h1 className="display-font mb-3 text-2xl font-extrabold text-[#354172] md:text-3xl">
                    {dailyTitle}
                  </h1>
                  <button
                    type="button"
                    onClick={() => navigate('/daily-words')}
                    className="pill-button w-full px-5 py-4 text-lg font-black text-[#4f3900] shadow-[0_8px_0_rgba(170,120,0,0.92),0_14px_24px_rgba(255,191,31,0.24)] transition-all duration-200 active:translate-y-0 active:scale-[0.98] md:w-auto md:px-8 md:text-[2rem] md:shadow-[0_12px_0_rgba(170,120,0,0.92),0_18px_30px_rgba(255,191,31,0.30)] md:hover:-translate-y-0.5 md:hover:brightness-105"
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
                  <div className="rounded-[18px] bg-white/78 px-2 py-2 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)] md:px-3 md:py-3">
                    <div className="text-lg font-bold text-[#354172] md:text-2xl">{data?.total_words ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">総単語数</div>
                  </div>
                  <div className="rounded-[18px] bg-white/78 px-2 py-2 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)] md:px-3 md:py-3">
                    <div className="text-lg font-bold text-[#354172] md:text-2xl">{data?.mastered_words ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">習得単語</div>
                  </div>
                  <div className="rounded-[18px] bg-white/78 px-2 py-2 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)] md:px-3 md:py-3">
                    <div className="text-lg font-bold text-[#354172] md:text-2xl">{data?.study_days ?? '-'}</div>
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

              {todayGrammarLesson && (
                <div className="rounded-[24px] border border-[#dcecff] bg-white/82 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.08)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#51688f]">
                          今日の文法レッスン
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${
                          isGrammarComplete ? 'bg-[#eefbf1] text-[#2f6b42]' : 'bg-[#fff7d6] text-[#6b5a2d]'
                        }`}>
                          {grammarStatusText}
                        </span>
                      </div>
                      <h2 className="display-font mt-3 text-2xl font-extrabold leading-tight text-[#354172]">
                        {todayGrammarLesson.title}
                      </h2>
                      <p className="mt-1 text-sm font-bold leading-6 text-[#60709d]">
                        {todayGrammarLesson.grammarPoint}
                      </p>
                      <p className="mt-2 text-xs font-black text-[#8fa0c2]">
                        文法 {grammarStats.mastered || 0} / {grammarStats.total || 0} レッスン
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/grammar')}
                      className="pill-button shrink-0 px-5 py-3 text-sm"
                    >
                      {grammarButtonText}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative mx-auto flex w-full max-w-[260px] justify-center md:max-w-[300px] xl:max-w-[340px] xl:pt-1">
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
        <div className="relative overflow-hidden rounded-[26px] border border-white/90 bg-[linear-gradient(180deg,rgba(233,247,255,0.98)_0%,rgba(242,250,255,0.92)_100%)] px-4 py-5 shadow-[0_18px_46px_rgba(145,177,209,0.16)] md:rounded-[30px] md:px-7 md:py-8">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" />
          <div className="pointer-events-none absolute -right-4 bottom-6 text-4xl text-white/55">✦</div>

          <div>
            <p className="text-xs font-black text-[#8fa0c2]">拡張</p>
            <h2 className="display-font mt-1 text-2xl font-extrabold text-[#1f315f]">学習メニュー</h2>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-3 md:gap-4">
            {dailyTrainingItems.map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex min-h-[112px] flex-col items-start gap-2 rounded-2xl border border-white/90 bg-white/78 p-3 text-[#1f315f] shadow-[0_12px_30px_rgba(145,177,209,0.10)] transition-all duration-200 active:scale-[0.98] md:min-h-[118px] md:rounded-3xl md:p-4 md:hover:-translate-y-1 md:hover:bg-white/92 md:hover:shadow-lg ${
                  index === 6 ? 'col-span-2 md:col-span-1' : ''
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[#dfeefa] bg-[#f8fcff] text-base font-black shadow-[inset_0_0_0_1px_rgba(132,173,222,0.10)] md:h-14 md:w-14 md:rounded-[20px] md:text-xl">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="display-font block text-[13px] font-extrabold leading-snug md:text-base">{item.label}</span>
                  <span className="mt-1 block text-xs font-bold leading-5 text-[#536685] md:text-sm">{item.subtitle}</span>
                </span>
                <span className="mt-auto hidden shrink-0 text-xs font-black text-[#3b4864] md:block">
                  {item.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
