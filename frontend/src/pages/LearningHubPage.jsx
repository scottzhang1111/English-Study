import { Link, useNavigate } from 'react-router-dom';
import { getChildren } from '../api';
import { useChildren } from '../ChildrenContext';
import { EQBottomNav, EQMobileShell } from '../components/eigo';
import eigoQuestWorlds from '../config/eigoQuestWorlds';
import { useBgm } from '../context/BgmContext';

const ASSET_BASE = '/assets/eigo-quest/learning-hub';
const DEFAULT_CHILD_AVATAR = '/assets/eigo-quest/child icon/child4.png';

function resolveChildAvatar(child) {
  const avatar = child?.avatar || '';
  return avatar.startsWith('/assets/') ? avatar : DEFAULT_CHILD_AVATAR;
}

function normalizeTargetLevel(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

const mainEntry = {
  title: '今日の冒険',
  subtitle: '前に覚えた単語をチェックしよう',
  action: '冒険をはじめる',
  image: `${ASSET_BASE}/上の背景.png`,
};

const moduleEntries = [
  {
    title: 'まちがい復習',
    subtitle: 'まちがえた問題をもう一度チェック',
    badge: '復習',
    to: '/review',
    image: `${ASSET_BASE}/まちがい復習.png`,
  },
  {
    title: '文法の神殿',
    subtitle: '基礎から学べる文法のレッスン',
    badge: '文法',
    to: '/grammar',
    image: `${ASSET_BASE}/文法の神殿.png`,
  },
  {
    title: '英検クエスト',
    subtitle: '級ごとの学習でステップアップ！',
    badge: '英検',
    to: '/eiken',
    image: `${ASSET_BASE}/英検クエスト.png`,
  },
  {
    title: 'AI面接練習',
    subtitle: '英検準2級の流れで5つの質問に答えよう',
    badge: '準2級',
    to: '/interview',
    image: `${ASSET_BASE}/英検クエスト.png`,
    pre2Only: true,
  },
  {
    title: '英検本番形式',
    subtitle: '本番そっくりの問題で実力をチェック！',
    badge: '英検',
    to: '/eiken-real',
    image: `${ASSET_BASE}/英検本番形式.png`,
  },
  {
    title: '単語図書館',
    subtitle: '語彙をふやして表現の幅を広げよう',
    badge: '単語',
    to: '/learned-words',
    image: `${ASSET_BASE}/単語図書館.png`,
  },
  {
    title: 'AI先生',
    subtitle: 'AI先生と会話して英語を楽しもう！',
    badge: 'AI',
    to: '/essay-check',
    image: `${ASSET_BASE}/AI先生.png`,
  },
];

export default function LearningHubPage() {
  const navigate = useNavigate();
  const { children, selectedChildId, setSelectedChildId } = useChildren();
  const { resumeGlobalBgm } = useBgm();
  const currentChild = (children || []).find((c) => String(c.id) === String(selectedChildId)) || (children && children.length ? children[0] : null);
  const targetLevel = String(
    currentChild?.targetLevel
      || currentChild?.target_level
      || currentChild?.learningGoal
      || currentChild?.learning_goal
      || currentChild?.grade
      || '',
  );
  const normalizedTargetLevel = normalizeTargetLevel(targetLevel);
  const isPre2Child = normalizedTargetLevel === 'eiken_pre2'
    || normalizedTargetLevel === 'eiken_pre_2'
    || normalizedTargetLevel === 'pre2'
    || normalizedTargetLevel.includes('準2')
    || normalizedTargetLevel.includes('準２');
  const mockTestEntry = isPre2Child
    ? {
        title: '英検準2級 模擬テスト',
        subtitle: '準2級の本番形式で実力をチェック',
        badge: '準2級',
        to: '/eiken-real',
        image: `${ASSET_BASE}/英検本番形式.png`,
      }
    : {
        title: '英検3級 模擬テスト',
        subtitle: 'G3SET01〜G3SET10で30問チャレンジ',
        badge: '3級',
        to: '/eiken3',
        image: `${ASSET_BASE}/英検本番形式.png`,
      };
  const visibleModuleEntries = [
    ...moduleEntries.filter((entry) => !entry.pre2Only || isPre2Child),
    mockTestEntry,
  ];

  function resolveWorldId(child) {
    const rawWorldId = child?.current_world_id || child?.currentWorldId || child?.current_world || child?.currentWorld || 1;
    const numericWorldId = Number(rawWorldId);
    if (Number.isFinite(numericWorldId) && numericWorldId > 0) {
      return eigoQuestWorlds[numericWorldId - 1]?.id || eigoQuestWorlds[0]?.id || 'wind';
    }
    const normalizedWorldId = String(rawWorldId || '').trim();
    return eigoQuestWorlds.some((world) => world.id === normalizedWorldId)
      ? normalizedWorldId
      : eigoQuestWorlds[0]?.id || 'wind';
  }

  async function handleStartAdventure() {
    resumeGlobalBgm();
    const currentChild = children.find((child) => String(child.id) === String(selectedChildId)) || children[0];
    if (currentChild) {
      navigate('/daily-review');
      return;
    }

    try {
      const payload = await getChildren();
      const childList = payload.children || [];
      if (childList.length === 0) {
        navigate('/create-child-profile');
        return;
      }
      setSelectedChildId(childList[0].id);
      navigate('/daily-review');
    } catch (err) {
      navigate('/create-child-profile');
    }
  }

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-learning-hub-rpg-screen">
        <header className="eq-learning-hub-rpg-header">
          <span>Learning Menu</span>
          <h1>学習メニュー</h1>
          <p>今日の学びをえらぼう</p>
          {currentChild ? (
            <button
              type="button"
              className="eq-learning-hub-child"
              onClick={() => navigate('/settings?child_switch=1')}
              aria-label={`${currentChild.nickname || currentChild.name || '子ども'} を選択`}
            >
              <img
                src={resolveChildAvatar(currentChild)}
                alt={currentChild.nickname || currentChild.name || 'child'}
                onError={(e) => { e.currentTarget.src = DEFAULT_CHILD_AVATAR; }}
              />
            </button>
          ) : null}
        </header>

        <button
          type="button"
          onClick={handleStartAdventure}
          className="eq-learning-hub-rpg-main"
          style={{ '--hub-card-image': `url("${mainEntry.image}")` }}
          aria-label={`${mainEntry.title}へ`}
        >
          <span className="eq-learning-hub-rpg-main-copy">
            <strong>{mainEntry.title}</strong>
            <small>{mainEntry.subtitle}</small>
            <em>{mainEntry.action}</em>
          </span>
          <span className="eq-learning-hub-rpg-arrow" aria-hidden="true">›</span>
        </button>

        <section className="eq-learning-hub-rpg-grid" aria-label="学習メニュー">
          {visibleModuleEntries.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              className="eq-lh-module-card"
              style={{ '--lh-module-image': `url("${entry.image}")` }}
              aria-label={`${entry.title}へ`}
            >
              <div className="eq-lh-module-body">
                <span className="eq-lh-module-tag">{entry.badge}</span>
                <strong>{entry.title}</strong>
                <small>{entry.subtitle}</small>
              </div>
              <span className="eq-lh-arrow" aria-hidden="true">›</span>
            </Link>
          ))}
        </section>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
