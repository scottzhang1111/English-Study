import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, Navigate, NavLink, useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import { EQBottomNav, EQBrandHeader, EQCard, EQMobileShell } from '../components/eigo';
import { getGrammarLessons, getHomeData } from '../api';
import { useChildren } from '../ChildrenContext';
import { getPartner } from '../utils/childStorage';
import { getEigoQuestProgress } from '../helpers/eigoQuestProgress';
import eigoQuestCards from '../config/eigoQuestCards';
import { eigoQuestIconAssets } from '../config/eigoQuestAssets';

const DEFAULT_DAILY_WORD_TARGET = 20;
const EQ_WORDS_PER_WORLD = 200;
const EQ_WORDS_PER_STAGE = 20;
const HOME_WORLD_NAME_JA = {
  wind: '風の区域',
  fire: '火の山',
  thunder: '雷の谷',
  wood: '木の森',
  rock: '岩の洞窟',
  shadow: '影の城',
  water: '水の都',
  light: '光の神殿',
};
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

const MENU_ICONS = ['📖', '📝', '🔗', '❌', '✍️', '🏆', '🎧'];

const AIR_RABBIT_DEFAULT_IMAGE = '/pets/AIR_RABBIT1.png';
const AIR_RABBIT_IMAGES = {
  idle: AIR_RABBIT_DEFAULT_IMAGE,
  happy: '/pets/AIR_RABBIT1_Happy.png',
  encourage: '/pets/AIR_RABBIT1_Pump.png',
  excited: '/pets/AIR_RABBIT1_Jump.png',
  sleep: '/pets/AIR_RABBIT1_Sleep.png',
};

function EQMenuIcon({ src, fallback }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <span className="eq-menu-icon">
      {src && !imageFailed ? (
        <img
          src={src}
          alt=""
          className="eq-decorative-image"
          loading="lazy"
          aria-hidden="true"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{fallback || '✨'}</span>
      )}
    </span>
  );
}

function getMenuIconSrc(to) {
  if (to === '/flashcard') return eigoQuestIconAssets.word;
  if (to === '/quiz') return eigoQuestIconAssets.quiz;
  if (to === '/grammar-practice') return eigoQuestIconAssets.grammar;
  if (to === '/review') return eigoQuestIconAssets.review;
  if (to === '/vocab-expansion') return eigoQuestIconAssets.study;
  if (to === '/eiken-pre2' || to === '/eiken-real') return eigoQuestIconAssets.study;
  return '';
}

const AIR_RABBIT_LINES = {
  encourage: '大丈夫、つぎはいけるよ',
  idle: '今日はなにを学ぶ？',
  happy: 'いい感じ！その調子！',
  excited: 'すごい！ボーナス中！',
  sleep: 'また明日ね…',
};

const AIR_RABBIT_MOOD_STYLES = {
  idle: { scale: 1, x: 0, y: 0 },
  happy: { scale: 0.96, x: 0, y: 2 },
  encourage: { scale: 0.98, x: 0, y: 1 },
  excited: { scale: 0.95, x: 1, y: 0 },
  sleep: { scale: 1.03, x: 0, y: 4 },
};

function usePetMood() {
  const [mood, setMood] = useState('idle');
  const moodTimerRef = useRef(null);
  const sleepTimerRef = useRef(null);

  const clearMoodTimer = () => {
    if (moodTimerRef.current) window.clearTimeout(moodTimerRef.current);
    moodTimerRef.current = null;
  };

  const resetSleepTimer = () => {
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = window.setTimeout(() => setMood('sleep'), 60000);
  };

  const triggerPetMood = (type) => {
    const config = {
      correct: ['happy', 1200],
      wrong: ['encourage', 1500],
      passed: ['excited', 2500],
    }[type];
    if (!config) return;
    clearMoodTimer();
    setMood(config[0]);
    moodTimerRef.current = window.setTimeout(() => setMood('idle'), config[1]);
    resetSleepTimer();
  };

  const wakePet = () => {
    if (mood === 'sleep') setMood('idle');
    resetSleepTimer();
  };

  useEffect(() => {
    resetSleepTimer();
    return () => {
      clearMoodTimer();
      if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    };
  }, []);

  return { mood, triggerPetMood, wakePet };
}

function AirRabbitTrial({ mood: moodProp, onWake, className = '', strip = false }) {
  const [overrideMood, setOverrideMood] = useState(null);
  const [isBouncing, setIsBouncing] = useState(false);
  const bounceTimerRef = useRef(null);
  const mood = overrideMood || moodProp || 'idle';
  const imageSrc = AIR_RABBIT_IMAGES[mood] || AIR_RABBIT_DEFAULT_IMAGE;
  const transform = AIR_RABBIT_MOOD_STYLES[mood] || AIR_RABBIT_MOOD_STYLES.idle;

  useEffect(() => {
    return () => {
      if (bounceTimerRef.current) window.clearTimeout(bounceTimerRef.current);
    };
  }, []);

  const handleClick = () => {
    onWake?.();
    if (bounceTimerRef.current) window.clearTimeout(bounceTimerRef.current);
    setOverrideMood('excited');
    setIsBouncing(true);
    bounceTimerRef.current = window.setTimeout(() => {
      setOverrideMood(null);
      setIsBouncing(false);
      bounceTimerRef.current = null;
    }, 800);
  };

  const handleImageError = (event) => {
    if (event.currentTarget.src.endsWith('/pets/AIR_RABBIT1.png')) return;
    event.currentTarget.src = AIR_RABBIT_DEFAULT_IMAGE;
  };

  return (
    <div className={`${strip ? 'air-rabbit-strip-card' : 'air-rabbit-card'} ${className}`}>
      <button
        type="button"
        className={`${strip ? 'air-rabbit-strip-stage' : 'air-rabbit-stage'} pet-aura`}
        onClick={handleClick}
        aria-label="Air Rabbit"
      >
        <img
          src={imageSrc}
          alt="Air Rabbit"
          className={`air-rabbit-pet ${isBouncing ? 'is-bouncing' : ''}`}
          style={{
            '--pet-scale': transform.scale,
            '--pet-breathe-scale': transform.scale * 1.035,
            '--pet-bounce-high-scale': transform.scale * 1.09,
            '--pet-bounce-low-scale': transform.scale * 0.96,
            '--pet-bounce-mid-scale': transform.scale * 1.03,
            '--pet-x': `${transform.x}px`,
            '--pet-y': `${transform.y}px`,
          }}
          onError={handleImageError}
          loading="lazy"
        />
      </button>
      {!strip && <p className="air-rabbit-bubble">{AIR_RABBIT_LINES[mood]}</p>}
    </div>
  );
}

const DESKTOP_NAV_ITEMS = [
  { label: 'ホーム', path: '/', icon: '⌂' },
  { label: 'ペット図鑑', path: '/pokedex', icon: '★' },
  { label: 'ぼうけんの記録', path: '/progress', icon: '↗' },
  { label: '設定', path: '/settings', icon: '⚙' },
];

function DesktopDashboardNav() {
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-6 rounded-[30px] border border-white/80 bg-white/86 p-3 shadow-[0_16px_36px_rgba(129,164,199,0.14)] backdrop-blur">
        <div className="px-3 py-3">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9aa7c4]">英楽語</p>
          <p className="mt-1 text-sm font-bold text-[#52668c]">学習ダッシュボード</p>
        </div>
        <div className="mt-2 grid gap-2">
          {DESKTOP_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-[18px] px-3 py-3 text-sm font-bold transition ${
                  isActive
                    ? 'bg-[#fff2a8] text-[#5f4a00] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)]'
                    : 'text-[#65779f] hover:bg-[#f6fbff]'
                }`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-white/80 text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}

export default function HomePage() {
  const [data, setData] = useState(null);
  const [grammarData, setGrammarData] = useState(null);
  const [error, setError] = useState(null);
  const [partnerLineIndex, setPartnerLineIndex] = useState(0);
  const [hasNoChildren, setHasNoChildren] = useState(false);
  const [homeWorldImageFailed, setHomeWorldImageFailed] = useState(false);
  const [homeRewardImageFailed, setHomeRewardImageFailed] = useState(false);
  const { children, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();
  const navigate = useNavigate();
  const { mood: petMood, triggerPetMood, wakePet } = usePetMood();
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
  const dailyTaskStatus = isDailyOverComplete ? 'ボーナス中' : isDailyComplete ? '完了!' : `${todayStudied} / ${safeTodayTarget}`;
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
    if (!selectedChildId || hasNoChildren || !selectedChild) return;
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
  }, [hasNoChildren, selectedChild, selectedChildId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPartnerLineIndex((index) => (index + 1) % PARTNER_LINES.length);
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);

  const progressWidth = data
    ? `${Math.min(100, (todayStudied / safeTodayTarget) * 100)}%`
    : '0%';
  const grammarDailyDone = isGrammarComplete ? 1 : 0;
  const grammarTaskStatus = isGrammarComplete ? '完了!' : 'あと1レッスン';
  const grammarProgressWidth = `${grammarDailyDone * 100}%`;
  const grammarLessonTitle = todayGrammarLesson?.title || '今日の文法';
  const partner = selectedChild ? getPartner(selectedChild.partnerMonsterId) : null;
  const learnedWordsCount = Number(data?.mastered_words ?? data?.learned_words ?? todayStudied ?? 0);
  const questProgress = getEigoQuestProgress(learnedWordsCount);
  const adventureProgress = questProgress.stageProgressPercent || 0;
  const adventureProgressLabel = `${adventureProgress}%`;
  const petImage = data?.pet?.image_url || data?.pet?.sprite_url || data?.pet?.imageUrl || partner?.image_url || AIR_RABBIT_DEFAULT_IMAGE;
  const petName = data?.pet?.name || partner?.name || 'Air Rabbit';
  const mobileDateLabel = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
  const mobileLearningItems = [
    {
      title: '単語カード',
      subtitle: '読む・聞く・例文で覚える',
      badge: '目標クリア +40',
      to: '/flashcard',
      icon: '単',
    },
    {
      title: 'クイズ練習',
      subtitle: '覚えた単語をチェック',
      badge: '未開始',
      to: '/quiz',
      icon: 'Q',
    },
    {
      title: '類義語・対義語',
      subtitle: '似た言葉・反対の言葉をチェック',
      badge: '1500 words',
      to: '/vocab-expansion',
      icon: '語',
    },
    {
      title: 'まちがい直し',
      subtitle: '苦手な問題をもう一度',
      badge: '3問',
      to: '/review',
      icon: '直',
    },
    {
      title: '文法練習',
      subtitle: '学んだ文法から5問',
      badge: 'ランダム',
      to: '/grammar-practice',
      icon: '文',
    },
    {
      title: '英検チャレンジ',
      subtitle: '準2級の模擬テストに挑戦',
      badge: '模擬テスト',
      to: '/eiken-pre2',
      icon: '英',
    },
  ];

  const totalProgressText = `${questProgress.learnedWords} / ${questProgress.totalWords} words`;
  const streakDays = Number(data?.study_days ?? data?.streak_days ?? 0);
  const coins = Number(data?.coins ?? data?.coin ?? 0);
  const quizDone = Number(data?.today_quiz_correct ?? data?.quiz_progress ?? 3);
  const quizTarget = Number(data?.today_quiz_target ?? 5);
  const wrongReviewDone = Number(data?.today_review_done ?? 0);
  const wrongReviewTarget = Number(data?.today_review_target ?? 3);
  const rewardCard = eigoQuestCards.find((card) => card.worldId === questProgress.currentWorld.id) || eigoQuestCards[0];
  const currentWorldWordsRaw = questProgress.learnedWords % EQ_WORDS_PER_WORLD;
  const currentWorldWords = questProgress.learnedWords > 0 && currentWorldWordsRaw === 0
    ? EQ_WORDS_PER_WORLD
    : currentWorldWordsRaw;
  const currentWorldStage = Math.min(10, Math.max(1, Math.floor(currentWorldWords / EQ_WORDS_PER_STAGE) + 1));
  const currentWorldProgressLabel = `${currentWorldWords} / ${EQ_WORDS_PER_WORLD} words`;
  const currentWorldProgressPercent = `${Math.min(100, Math.round((currentWorldWords / EQ_WORDS_PER_WORLD) * 100))}%`;
  const worldDisplayName = HOME_WORLD_NAME_JA[questProgress.currentWorld.id] || questProgress.currentWorld.nameJa || '風の区域';
  const worldEnglishLabel = `${String(questProgress.currentWorld.id || 'wind').toUpperCase()} REALM`;
  const rewardCardName = questProgress.currentWorld.id === 'wind' ? 'そよ風の精霊' : (rewardCard?.nameJa || 'そよ風の精霊');
  const rewardCardImage = questProgress.currentWorld.id === 'wind'
    ? '/assets/eigo-quest/cards/wind/wind-guardian1.png'
    : rewardCard?.image;
  const compactLearningItems = [
    { title: '単語', subtitle: '読む・聞く・例文', to: '/flashcard', icon: '単' },
    { title: 'クイズ', subtitle: '覚えた単語を確認', to: '/quiz', icon: 'Q' },
    { title: '文法', subtitle: '文法5問チャレンジ', to: '/grammar-practice', icon: '文' },
    { title: 'まちがい', subtitle: '苦手を復習', to: '/review', icon: '直' },
  ];
  const homeQuickActions = [
    { title: '単語', subtitle: '新しい単語を覚えよう！', to: '/flashcard', icon: '単', iconSrc: eigoQuestIconAssets.word },
    { title: 'クイズ', subtitle: 'クイズに挑戦しよう！', to: '/quiz', icon: 'Q', iconSrc: eigoQuestIconAssets.quiz },
    { title: '文法', subtitle: '文法のルールを学ぼう！', to: '/grammar-practice', icon: '文', iconSrc: eigoQuestIconAssets.grammar },
    { title: 'まちがい直し', subtitle: '間違えた問題を復習しよう！', to: '/review', icon: '直', iconSrc: eigoQuestIconAssets.review },
  ];
  const grammarMissionDone = isGrammarComplete ? 1 : 0;

  useEffect(() => {
    window.triggerHomePetMood = triggerPetMood;
    return () => {
      if (window.triggerHomePetMood === triggerPetMood) delete window.triggerHomePetMood;
    };
  }, [triggerPetMood]);

  useEffect(() => {
    setHomeWorldImageFailed(false);
  }, [questProgress.currentWorld.id]);

  useEffect(() => {
    setHomeRewardImageFailed(false);
  }, [rewardCardImage]);

  if (childrenLoading) {
    return null;
  }

  if (childrenError) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        <HeaderBar subtitle="英語を楽しく、毎日の習慣に。" />
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
        <HeaderBar subtitle="英語を楽しく、毎日の習慣に。" />
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
    <>
    <div className="eq-home-mobile-root lg:hidden" onPointerDown={wakePet}>
      <EQMobileShell className="eq-home-menu">
        <section className="eq-home-brand-panel">
          <EQBrandHeader
            title="英語クエスト"
            subtitle="今日もクエストを進めよう！"
            className="eq-home-brand"
          />
          <div className="eq-home-header-actions" aria-label="ホーム操作">
            <button type="button" aria-label="お知らせ">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 17H9m9-2H6l1.4-1.9V9.6A4.6 4.6 0 0 1 12 5a4.6 4.6 0 0 1 4.6 4.6v3.5L18 15Z" />
                <path d="M10 18.2a2.2 2.2 0 0 0 4 0" />
              </svg>
            </button>
            <Link to="/settings" aria-label="設定">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
                <path d="M19 13.4v-2.8l-2.1-.7a5.8 5.8 0 0 0-.6-1.3l1-2-2.1-1.4-1.7 1.4a6.4 6.4 0 0 0-1.5-.1l-1.7-1.3-2.1 1.4 1 2a5.8 5.8 0 0 0-.6 1.3l-2.1.7v2.8l2.1.7c.2.5.4.9.6 1.3l-1 2 2.1 1.4 1.7-1.3c.5.1 1 .1 1.5.1l1.7 1.3 2.1-1.4-1-2c.3-.4.5-.8.6-1.3l2.1-.8Z" />
              </svg>
            </Link>
          </div>
          <div className="eq-home-mini-stats">
            <span>連続日数 {streakDays}日</span>
            <span>コイン {coins}</span>
          </div>
        </section>

        <EQCard className="eq-home-status-card">
          <div>
            <span>連</span>
            <small>連続学習日数</small>
            <strong>{streakDays}日</strong>
          </div>
          <div>
            <span>語</span>
            <small>これまでに学んだ単語</small>
            <strong>{questProgress.learnedWords} words</strong>
          </div>
          <div>
            <span>C</span>
            <small>所持コイン</small>
            <strong>{coins}</strong>
          </div>
        </EQCard>

        <section className="eq-home-greeting">
          <h1>Hello, {selectedChild.name} 👋</h1>
          <p>今日も冒険しよう！</p>
        </section>

        <EQCard className="eq-adventure-card eq-home-main-adventure">
          <div className="eq-home-adventure-bg" aria-hidden="true">
            {!homeWorldImageFailed && questProgress.currentWorld.backgroundImage ? (
              <img
                src={questProgress.currentWorld.backgroundImage}
                alt=""
                loading="lazy"
                onError={() => setHomeWorldImageFailed(true)}
              />
            ) : (
              <span>{questProgress.currentWorld.icon || '✨'}</span>
            )}
          </div>
          <div className="eq-home-hero-stack">
            <div className="eq-home-hero-copy">
              <p className="eq-home-hero-label">現在の冒険</p>
              <button type="button" className="eq-home-map-pill" onClick={() => navigate('/study-map')}>
                世界一覧
              </button>
              <h2>{worldDisplayName}</h2>
              <p className="eq-home-world-en">{worldEnglishLabel}</p>
              <p className="eq-home-world-description">
                風が導く、自由への旅。単語と文法を少しずつ覚える冒険
              </p>
              <div className="eq-home-hero-meta">
                <span>Stage {currentWorldStage} / 10</span>
                <strong>{currentWorldProgressLabel}</strong>
              </div>
              <div className="eq-home-hero-progress">
                <div className="eq-adventure-progress-row">
                  <span>この世界の進行度</span>
                  <strong>{currentWorldProgressPercent}</strong>
                </div>
                <div className="eq-progress-bar" style={{ '--eq-progress': currentWorldProgressPercent }} />
              </div>
              <button type="button" className="eq-home-stage-detail" onClick={() => navigate('/study-map')}>
                ステージ詳細 <span aria-hidden="true">›</span>
              </button>
            </div>

            <div className="eq-home-glass-panel eq-home-mission-panel">
              <h3>今日のミッション</h3>
              <div className="eq-home-mission-compact">
                <div>
                  <span className={todayStudied >= safeTodayTarget ? 'is-done' : ''}>{todayStudied >= safeTodayTarget ? '☑' : '□'}</span>
                  <strong>単語を学ぶ</strong>
                  <em>{todayStudied} / {safeTodayTarget}</em>
                </div>
                <div>
                  <span className={quizDone >= quizTarget ? 'is-done' : ''}>{quizDone >= quizTarget ? '☑' : '□'}</span>
                  <strong>クイズに挑戦</strong>
                  <em>{quizDone} / {quizTarget}</em>
                </div>
                <div>
                  <span className={wrongReviewDone >= wrongReviewTarget ? 'is-done' : ''}>{wrongReviewDone >= wrongReviewTarget ? '☑' : '□'}</span>
                  <strong>まちがい直し</strong>
                  <em>{wrongReviewDone} / {wrongReviewTarget}</em>
                </div>
              </div>
            </div>

            <div className="eq-home-glass-panel eq-home-reward-panel">
              <span>今日の報酬カード</span>
              <div className="eq-home-reward-visual">
                <div className="eq-home-reward-thumb">
                  {rewardCardImage && !homeRewardImageFailed ? (
                    <img
                      src={rewardCardImage}
                      alt={rewardCardName}
                      loading="lazy"
                      onError={() => setHomeRewardImageFailed(true)}
                    />
                  ) : (
                    <strong>{questProgress.currentWorld.icon || '風'}</strong>
                  )}
                </div>
                <div>
                  <strong>{rewardCardName}</strong>
                  <small>★★★</small>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => navigate('/daily-words')} className="eq-gold-button eq-home-primary-cta">
              冒険をつづける <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="eq-adventure-content">
            <div className="eq-adventure-copy">
              <p className="eq-caption">現在の冒険</p>
              <h2 className="eq-adventure-world">{questProgress.currentWorld.nameJa}</h2>
              <p className="eq-adventure-stage">{questProgress.stageLabel}</p>
              <p className="eq-home-total-progress">{totalProgressText}</p>
            </div>
            <div className="eq-reward-preview">
              <span className="eq-reward-card-icon">{questProgress.currentWorld.icon}</span>
              <span>報酬</span>
            </div>
          </div>
          <div className="eq-adventure-progress-row">
            <span>進行度</span>
            <strong>{adventureProgressLabel}</strong>
          </div>
          <div className="eq-progress-bar" style={{ '--eq-progress': adventureProgressLabel }} />

          <div className="eq-home-mission-list">
            <div>
              <span>単語を学ぶ</span>
              <strong>{todayStudied} / {safeTodayTarget}</strong>
            </div>
            <div>
              <span>クイズに挑戦</span>
              <strong>{quizDone} / {quizTarget}</strong>
            </div>
            <div>
              <span>まちがい直し</span>
              <strong>{wrongReviewDone} / {wrongReviewTarget}</strong>
            </div>
          </div>

          <div className="eq-home-reward-inline">
            <span>今日の報酬カード</span>
            <strong>{rewardCard?.nameJa || '風の精霊'}</strong>
          </div>

          <button type="button" onClick={() => navigate('/daily-words')} className="eq-gold-button eq-home-primary-cta">
            冒険をつづける
          </button>
        </EQCard>

        <section className="eq-home-compact-menu" aria-label="学習メニュー">
          {homeQuickActions.map((item) => (
            <Link key={item.to} to={item.to} className="eq-home-mode-card">
              <EQMenuIcon src={item.iconSrc || getMenuIconSrc(item.to)} fallback={item.icon} />
              <span className="eq-menu-copy">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="eq-home-daily-grid">
          <div className="eq-home-glass-panel eq-home-mission-panel">
            <h3>今日のミッション</h3>
            <div className="eq-home-mission-compact">
              <div>
                <span className={todayStudied >= safeTodayTarget ? 'is-done' : ''}>{todayStudied >= safeTodayTarget ? '☑' : '›'}</span>
                <strong>単語を学ぶ</strong>
                <em>{todayStudied} / {safeTodayTarget}</em>
              </div>
              <div>
                <span className={quizDone >= quizTarget ? 'is-done' : ''}>{quizDone >= quizTarget ? '☑' : '›'}</span>
                <strong>クイズに挑戦</strong>
                <em>{quizDone} / {quizTarget}</em>
              </div>
              <div>
                <span className={grammarMissionDone >= 1 ? 'is-done' : ''}>{grammarMissionDone >= 1 ? '☑' : '›'}</span>
                <strong>文法を練習</strong>
                <em>{grammarMissionDone} / 1</em>
              </div>
              <div>
                <span className={wrongReviewDone >= wrongReviewTarget ? 'is-done' : ''}>{wrongReviewDone >= wrongReviewTarget ? '☑' : '›'}</span>
                <strong>まちがい直し</strong>
                <em>{wrongReviewDone} / {wrongReviewTarget}</em>
              </div>
            </div>
          </div>

          <div className="eq-home-glass-panel eq-home-reward-panel">
            <span>今日の報酬カード</span>
            <div className="eq-home-reward-visual">
              <div className="eq-home-reward-thumb">
                {rewardCardImage && !homeRewardImageFailed ? (
                  <img
                    src={rewardCardImage}
                    alt={rewardCardName}
                    loading="lazy"
                    onError={() => setHomeRewardImageFailed(true)}
                  />
                ) : (
                  <strong>{questProgress.currentWorld.icon || '風'}</strong>
                )}
              </div>
              <div>
                <strong>{rewardCardName}</strong>
                <small>EXP +50</small>
                <small>Coin +30</small>
              </div>
            </div>
          </div>
        </section>

        <button type="button" onClick={() => navigate('/daily-words')} className="eq-gold-button eq-home-primary-cta eq-home-main-cta">
          冒険をつづける
        </button>

        <Link to="/cards" className="eq-home-reward-card-section">
          <span className="eq-caption">今日の報酬カード</span>
          <strong>{rewardCard?.nameJa || '風の精霊'}</strong>
          <span>ミッション達成で獲得！</span>
        </Link>
        <EQBrandHeader dateLabel={mobileDateLabel} />

        <section className="eq-home-title-block">
          <h1 className="eq-page-title">学習メニュー</h1>
          <p className="eq-caption">今日もクエストを進めよう</p>
        </section>

        <EQCard className="eq-adventure-card">
          <div className="eq-adventure-content">
            <div className="eq-adventure-copy">
              <p className="eq-caption">現在の冒険</p>
              <h2 className="eq-adventure-world">{questProgress.currentWorld.nameJa}</h2>
              <p className="eq-adventure-stage">{questProgress.stageLabel}</p>
            </div>
            <div className="eq-reward-preview">
              <img src={petImage} alt={petName} loading="lazy" />
              <span>報酬</span>
            </div>
          </div>
          <div className="eq-adventure-progress-row">
            <span>進行度</span>
            <strong>{adventureProgressLabel}</strong>
          </div>
          <div className="eq-progress-bar" style={{ '--eq-progress': adventureProgressLabel }} />
        </EQCard>

        <section className="eq-learning-grid" aria-label="学習メニュー">
          {mobileLearningItems.map((item) => (
            <Link key={item.to} to={item.to} className="eq-menu-card">
              <EQMenuIcon src={item.iconSrc || getMenuIconSrc(item.to)} fallback={item.icon} />
              <span className="eq-menu-copy">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </span>
              <span className="eq-menu-badge">{item.badge}</span>
            </Link>
          ))}
        </section>

        <Link to="/eiken-real" className="eq-real-exam-card">
          <EQMenuIcon src={eigoQuestIconAssets.study} fallback="真" />
          <span className="eq-menu-copy">
            <strong>英検真題</strong>
            <span>過去問とリスニング音声で練習</span>
          </span>
          <span className="eq-menu-badge">音声つき</span>
        </Link>
      </EQMobileShell>
      <EQBottomNav
        items={[
          { label: 'ホーム', to: '/app', icon: 'home', active: true },
          { label: '地図', to: '/study-map', icon: 'map' },
          { label: '学習', to: '/daily-words', icon: 'study' },
          { label: 'カード', to: '/flashcard', icon: 'cards' },
          { label: 'その他', to: '/settings', icon: 'more' },
        ]}
      />
      <EQBottomNav
        className="eq-home-bottom-nav"
        items={[
          { label: 'ホーム', to: '/app', icon: 'home', active: true },
          { label: '地図', to: '/study-map', icon: 'map' },
          { label: '学習', to: '/daily-words', icon: 'study' },
          { label: 'カード', to: '/cards', icon: 'cards' },
          { label: 'その他', to: '/settings', icon: 'more' },
        ]}
      />
    </div>

    <div className="home-mobile-refresh mx-auto hidden max-w-[1400px] overflow-x-hidden px-3 pb-28 pt-2 max-md:pb-32 sm:px-6 md:pb-10 lg:block lg:px-6 lg:pt-6" onPointerDown={wakePet}>
      <div className="lg:hidden">
        <HeaderBar subtitle="英語を楽しく、毎日の習慣に。" />
      </div>

      <div className="hidden lg:mb-6 lg:flex lg:min-h-[78px] lg:items-center lg:justify-between lg:rounded-[30px] lg:border lg:border-white/80 lg:bg-white/86 lg:px-6 lg:py-4 lg:shadow-[0_16px_36px_rgba(129,164,199,0.13)] lg:backdrop-blur">
        <div className="flex items-center gap-4">
          <img src="/assets/homepage-icon.png" alt="英楽語" className="h-14 w-14 rounded-[18px] object-cover shadow-[0_10px_20px_rgba(255,193,31,0.20)]" />
          <div>
            <h1 className="display-font text-2xl font-black text-[#31406f]">英楽語</h1>
            <p className="text-sm font-bold text-[#60709d]">英語を楽しく、毎日の習慣に。</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-[#31406f]">{selectedChild.name} さん</p>
          <p className="text-xs font-bold text-[#7d8db5]">{new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'long' }).format(new Date())}</p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)_300px] lg:items-start lg:gap-6">
        <DesktopDashboardNav />
        <main className="min-w-0">

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel hero-panel relative overflow-hidden px-4 py-4 shadow-[0_18px_42px_rgba(112,158,203,0.14)] max-md:px-3 max-md:py-3 md:px-6 md:py-5"
        >
          <div className="grid items-start gap-5 max-md:gap-3 xl:grid-cols-[minmax(0,1.28fr)_minmax(300px,0.72fr)]">
            <div className="space-y-4 max-md:space-y-4">
              <div className="inline-flex rounded-full bg-white/75 px-4 py-2 text-sm font-bold text-[#566a90] max-md:px-3 max-md:py-1.5 max-md:text-sm">
                今日の学習
              </div>

              <div className="home-child-card rounded-[24px] bg-white/80 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.08)] max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-extrabold text-[#354172] max-md:text-2xl max-md:font-bold">
                      {selectedChild.name} さん
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#61759e] max-md:text-sm max-md:font-semibold">
                      学年：{selectedChild.grade}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#61759e] max-md:text-sm max-md:font-semibold">
                      目標：{selectedChild.targetLevel}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/select-child')}
                      className="rounded-full bg-[#fff7d6] px-3 py-1 text-xs font-black text-[#6b5a2d] max-md:font-semibold"
                    >
                      切り替え
                    </button>
                  </div>
                  {partner && <p className="mt-2 text-xs font-bold text-[#6f7da8] max-md:text-sm max-md:font-medium">パートナー：{partner.name} Lv.1</p>}
                </div>
                {data?.pet && (
                  <div className="hidden shrink-0 text-center max-md:block">
                    {(data.pet.image_url || data.pet.sprite_url || data.pet.imageUrl) && (
                      <img
                        src={data.pet.image_url || data.pet.sprite_url || data.pet.imageUrl}
                        alt={data.pet.name || 'ペット'}
                        className="mx-auto h-14 w-14 object-contain"
                        loading="lazy"
                      />
                    )}
                    <p className="mt-1 max-w-[4.5rem] truncate text-xs font-black text-[#354172] max-md:font-semibold">{data.pet.name || partner?.name || 'ペット'}</p>
                  </div>
                )}
              </div>

              <div className="pet-companion-strip md:hidden">
                <div className="min-w-0 flex-1">
                  <p className="pet-companion-kicker">Air Rabbit</p>
                  <p className="pet-companion-line">{AIR_RABBIT_LINES[petMood]}</p>
                  <p className="pet-companion-subline">
                    {isDailyOverComplete ? '今日はボーナス中' : isDailyComplete ? '今日のミッション達成' : '今日も少しずつ'}
                  </p>
                </div>
                <AirRabbitTrial
                  mood={petMood}
                  onWake={wakePet}
                  strip
                  className="shrink-0"
                />
              </div>

              <div className="grid gap-3 max-md:grid-cols-2 max-md:gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => navigate('/daily-words')}
                  className="home-task-card home-task-card-word rounded-[24px] border border-[#f3d36a] bg-[linear-gradient(180deg,#fff6bd_0%,#ffd84f_100%)] p-4 text-left text-[#4f3900] shadow-[0_10px_0_rgba(170,120,0,0.78),0_16px_28px_rgba(255,191,31,0.22)] transition active:translate-y-0.5 active:shadow-[0_6px_0_rgba(170,120,0,0.78),0_10px_18px_rgba(255,191,31,0.18)] max-md:min-h-[116px] max-md:rounded-2xl max-md:p-3 max-md:shadow-[0_6px_0_rgba(170,120,0,0.72),0_10px_18px_rgba(255,191,31,0.18)] md:min-h-[140px] md:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="display-font text-2xl font-black leading-tight max-md:text-xl max-md:font-bold">単語を学ぶ</p>
                      <p className="mt-1 text-sm font-black text-[#6b5a2d] max-md:text-sm max-md:font-semibold">今日 {safeTodayTarget}語</p>
                    </div>
                    <span className="home-task-status shrink-0 rounded-full bg-white/82 px-3 py-1 text-xs font-black max-md:px-1.5 max-md:py-0.5 max-md:text-sm max-md:font-bold max-md:leading-none">{dailyTaskStatus}</span>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/70 max-md:mt-3 max-md:h-1.5">
                    <div className="h-full rounded-full bg-[#ffb81f]" style={{ width: progressWidth }} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/grammar')}
                  className="home-task-card home-task-card-grammar rounded-[24px] border border-[#dcecff] bg-white/86 p-4 text-left text-[#354172] shadow-[0_12px_26px_rgba(145,177,209,0.12)] transition hover:-translate-y-0.5 hover:bg-[#f8fcff] active:translate-y-0 max-md:min-h-[116px] max-md:rounded-2xl max-md:border-[#d8dcff] max-md:bg-[#f4f2ff] max-md:p-3 md:min-h-[140px] md:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="display-font text-2xl font-black leading-tight max-md:text-xl max-md:font-bold">文法を学ぶ</p>
                      <p className="mt-1 truncate text-sm font-black text-[#60709d] max-md:text-sm max-md:font-semibold">{grammarLessonTitle}</p>
                      <p className="mt-0.5 text-xs font-bold text-[#8fa0c2] max-md:text-xs max-md:font-medium">今日 1レッスン</p>
                    </div>
                    <span className="home-task-status shrink-0 rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#51688f] max-md:px-1.5 max-md:py-0.5 max-md:text-sm max-md:font-bold max-md:leading-none">{grammarTaskStatus}</span>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#edf1f7] max-md:mt-3 max-md:h-1.5">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#bdefff,#83d7ff)]" style={{ width: grammarProgressWidth }} />
                  </div>
                </button>
              </div>

              <div className="hidden grid gap-4 max-md:gap-3 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                <div className="min-w-0">
                  <h1 className="display-font mb-3 text-2xl font-extrabold text-[#354172] max-md:mb-2 max-md:text-xl md:text-3xl">
                    {dailyTitle}
                  </h1>
                  <div className="flex flex-col gap-3 max-md:gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => navigate('/daily-words')}
                    className="pill-button w-full px-5 py-4 text-lg font-black text-[#4f3900] shadow-[0_8px_0_rgba(170,120,0,0.92),0_14px_24px_rgba(255,191,31,0.24)] transition-all duration-200 active:translate-y-0 active:scale-[0.98] max-md:h-14 max-md:py-3 max-md:text-base sm:w-auto md:px-8 md:text-[2rem] md:shadow-[0_12px_0_rgba(170,120,0,0.92),0_18px_30px_rgba(255,191,31,0.30)] md:hover:-translate-y-0.5 md:hover:brightness-105"
                  >
                    {dailyButtonText}
                  </button>
                  {isDailyOverComplete && (
                    <button
                      type="button"
                      onClick={() => navigate('/petroom')}
                      className="w-full rounded-full border border-[#d9e8f8] bg-white/90 px-6 py-3 text-sm font-black text-[#435987] shadow-[0_10px_22px_rgba(103,148,191,0.10)] transition hover:-translate-y-0.5 hover:bg-[#f8fcff] max-md:h-10 max-md:px-4 max-md:py-2 max-md:text-xs sm:w-auto"
                    >
                      ペットを見る
                    </button>
                  )}
                  </div>
                  <p className="mt-3 text-[0.98rem] leading-6 text-[#44556f] max-md:mt-2 max-md:text-sm max-md:leading-5 sm:text-base">
                    {dailyMessage}
                  </p>
                  {isDailyOverComplete && (
                    <p className="mt-2 text-sm font-bold text-[#6f7da8]">つづける時は、少し休んでからね。</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 max-md:gap-1.5">
                  <div className="rounded-[18px] bg-white/78 px-2 py-2 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)] max-md:rounded-2xl max-md:py-1.5 md:px-3 md:py-3">
                    <div className="text-lg font-bold text-[#354172] md:text-2xl">{data?.total_words ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">総単語数</div>
                  </div>
                  <div className="rounded-[18px] bg-white/78 px-2 py-2 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)] max-md:rounded-2xl max-md:py-1.5 md:px-3 md:py-3">
                    <div className="text-lg font-bold text-[#354172] md:text-2xl">{data?.mastered_words ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">習得単語</div>
                  </div>
                  <div className="rounded-[18px] bg-white/78 px-2 py-2 text-center shadow-[0_10px_20px_rgba(145,177,209,0.08)] max-md:rounded-2xl max-md:py-1.5 md:px-3 md:py-3">
                    <div className="text-lg font-bold text-[#354172] md:text-2xl">{data?.study_days ?? '-'}</div>
                    <div className="text-xs font-semibold text-[#5c6d92]">学習日数</div>
                  </div>
                </div>
              </div>

              {data && (
                <div className="hidden">
                  <div className="rounded-[24px] bg-white/80 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.08)] max-md:p-3">
                    <div className="flex items-center justify-between gap-4 text-sm font-bold text-[#5e7093] max-md:text-xs">
                      <span>今日の単語</span>
                      <span>{todayStudied} / {safeTodayTarget}</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edf1f7] max-md:mt-2 max-md:h-2.5">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffe65a,#ffb81f)] transition-all duration-300" style={{ width: progressWidth }} />
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-white/80 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.08)] max-md:p-3">
                    <div className="flex items-center justify-between gap-4 text-sm font-bold text-[#5e7093] max-md:text-xs">
                      <span>今日の文法</span>
                      <span>{grammarDailyDone} / 1</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#edf1f7] max-md:mt-2 max-md:h-2.5">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#bdefff,#83d7ff)] transition-all duration-300" style={{ width: grammarProgressWidth }} />
                    </div>
                  </div>
                </div>
              )}

              <div className="home-compact-stats grid grid-cols-3 gap-2 rounded-[22px] bg-white/54 p-2 md:max-w-md">
                <div className="rounded-2xl bg-white/68 px-2 py-2 text-center">
                  <div className="text-sm font-black text-[#354172] max-md:text-xl max-md:font-bold md:text-base">{data?.total_words ?? '-'}</div>
                  <div className="text-[10px] font-bold text-[#6f7da8] max-md:text-xs max-md:font-semibold">総単語数</div>
                </div>
                <div className="rounded-2xl bg-white/68 px-2 py-2 text-center">
                  <div className="text-sm font-black text-[#354172] max-md:text-xl max-md:font-bold md:text-base">{data?.mastered_words ?? '-'}</div>
                  <div className="text-[10px] font-bold text-[#6f7da8] max-md:text-xs max-md:font-semibold">習得単語</div>
                </div>
                <div className="rounded-2xl bg-white/68 px-2 py-2 text-center">
                  <div className="text-sm font-black text-[#354172] max-md:text-xl max-md:font-bold md:text-base">{data?.study_days ?? '-'}</div>
                  <div className="text-[10px] font-bold text-[#6f7da8] max-md:text-xs max-md:font-semibold">学習日数</div>
                </div>
              </div>

              {false && data?.pet && (
                <div className="flex items-center gap-3 rounded-[22px] border border-white/80 bg-white/82 p-3 shadow-[0_10px_24px_rgba(145,177,209,0.10)] md:hidden">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#f8fcff]">
                    {(data.pet.image_url || data.pet.sprite_url || data.pet.imageUrl) ? (
                      <img
                        src={data.pet.image_url || data.pet.sprite_url || data.pet.imageUrl}
                        alt={data.pet.name || 'ペット'}
                        className="h-14 w-14 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-lg font-black text-[#354172]">P</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#354172]">{data.pet.name || 'ペット'}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[#60709d]">{petBubbleText}</p>
                  </div>
                </div>
              )}

              {false && todayGrammarLesson && (
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

            <div className="relative mx-auto hidden w-full max-w-[260px] justify-center md:flex md:max-w-[300px] lg:hidden xl:max-w-[340px] xl:pt-1">
              <AirRabbitTrial
                mood={petMood}
                onWake={wakePet}
                className="relative z-10 w-full"
              />
            </div>
          </div>
        </motion.section>

      <section className="mt-5 max-md:mt-3 lg:mt-6">
        <div className="relative overflow-hidden rounded-[26px] border border-white/90 bg-[linear-gradient(180deg,rgba(233,247,255,0.98)_0%,rgba(242,250,255,0.92)_100%)] px-4 py-5 shadow-[0_18px_46px_rgba(145,177,209,0.16)] max-md:px-3 max-md:py-4 md:rounded-[30px] md:px-7 md:py-8 lg:px-5 lg:py-5">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" />
          <div className="pointer-events-none absolute -right-4 bottom-6 text-4xl text-white/55">✦</div>

          <div>
            <p className="text-xs font-black text-[#8fa0c2] max-md:font-semibold">拡張</p>
            <h2 className="display-font mt-1 text-2xl font-extrabold text-[#1f315f] max-md:text-2xl max-md:font-bold">学習メニュー</h2>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 max-md:mt-4 max-md:gap-2.5 md:mt-8 md:grid-cols-3 md:gap-4 lg:mt-5">
            {dailyTrainingItems.map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
              className={`group flex min-h-[132px] flex-col items-start gap-2.5 rounded-2xl border border-white/90 bg-white/78 p-3.5 text-[#1f315f] shadow-[0_12px_30px_rgba(145,177,209,0.10)] transition-all duration-200 active:scale-[0.98] max-md:min-h-[108px] max-md:gap-2 max-md:p-3 md:min-h-[118px] md:rounded-3xl md:p-4 md:hover:-translate-y-1 md:hover:bg-white/92 md:hover:shadow-lg lg:min-h-[112px] ${
                  index === 6 ? 'col-span-2 md:col-span-1' : ''
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-[#dfeefa] bg-[#f8fcff] text-xl font-black shadow-[inset_0_0_0_1px_rgba(132,173,222,0.10)] max-md:h-10 max-md:w-10 max-md:rounded-[13px] max-md:text-lg md:h-14 md:w-14 md:rounded-[20px] md:text-2xl lg:h-10 lg:w-10 lg:rounded-[16px] lg:text-xl">
                  {MENU_ICONS[index] || item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="display-font block text-sm font-extrabold leading-snug max-md:text-base max-md:font-bold md:text-base">{item.label}</span>
                  <span className="mt-1.5 block text-[12px] font-bold leading-5 text-[#536685] max-md:mt-1 max-md:text-xs max-md:font-medium max-md:leading-4 md:text-sm">{item.subtitle}</span>
                </span>
                <span className="mt-auto shrink-0 rounded-full bg-[#eef8ff] px-2.5 py-1 text-[11px] font-black text-[#3b4864] max-md:px-2 max-md:py-0.5 max-md:text-[10px] max-md:font-semibold md:text-xs">
                  {item.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-[30px] border border-white/80 bg-white/86 p-5 shadow-[0_16px_36px_rgba(129,164,199,0.14)] backdrop-blur">
            <p className="text-xs font-black text-[#8fa0c2]">今日の相棒</p>
            <div className="mt-3 rounded-[24px] bg-[#f8fcff] p-4 text-center">
              <AirRabbitTrial
                mood={petMood}
                onWake={wakePet}
                className="mx-auto max-w-[220px]"
              />
            </div>
            <h2 className="mt-4 text-xl font-black text-[#31406f]">{data?.pet?.name || partner?.name || 'ペット'}</h2>
            <p className="mt-1 text-sm font-bold text-[#60709d]">Lv.{data?.pet?.level || 1}</p>
            <div className="mt-4 rounded-[20px] bg-white/72 p-3">
              <div className="flex items-center justify-between text-xs font-black text-[#61759e]">
                <span>EXP</span>
                <span>{data?.pet?.exp ?? 0} / {data?.pet?.max_exp ?? 100}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#edf1f7]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#bdefff,#ffd45a)]"
                  style={{
                    width: `${Math.min(100, (Number(data?.pet?.exp || 0) / Math.max(1, Number(data?.pet?.max_exp || 100))) * 100)}%`,
                  }}
                />
              </div>
            </div>
            {(isDailyComplete || isDailyOverComplete) && (
              <div className="mt-3 rounded-full bg-[#eefbf1] px-3 py-2 text-center text-xs font-black text-[#2f6b42]">今日の目標クリア</div>
            )}
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}
