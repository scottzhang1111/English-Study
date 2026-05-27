import { Link } from 'react-router-dom';
import { EQBottomNav, EQMobileShell } from '../components/eigo';

const ASSET_BASE = '/assets/eigo-quest/learning-hub';

const mainEntry = {
  title: '今日の冒険',
  subtitle: '20語を学んで、クイズに挑戦',
  action: '冒険をはじめる',
  to: '/daily-words',
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
    title: '今日の復習クイズ',
    subtitle: '今日の学びをクイズで確認しよう',
    badge: '復習',
    to: '/today-review-quiz',
    image: `${ASSET_BASE}/今日の復習クイズ.png`,
  },
  {
    title: '文法の神殿',
    subtitle: '基礎から学べる文法のレッスン',
    badge: '文法',
    to: '/grammar',
    image: `${ASSET_BASE}/文法の神殿.png`,
  },
  {
    title: '文法練習',
    subtitle: '問題を解いて文法を定着させよう',
    badge: '文法',
    to: '/grammar-practice',
    image: `${ASSET_BASE}/文法練習.png`,
  },
  {
    title: '英検クエスト',
    subtitle: '級ごとの学習でステップアップ！',
    badge: '英検',
    to: '/eiken',
    image: `${ASSET_BASE}/英検クエスト.png`,
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
    to: '/ai-practice',
    image: `${ASSET_BASE}/AI先生.png`,
  },
];

export default function LearningHubPage() {
  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-learning-hub-rpg-screen">
        <header className="eq-learning-hub-rpg-header">
          <span>Learning Menu</span>
          <h1>学習メニュー</h1>
          <p>今日の学びをえらぼう</p>
        </header>

        <Link
          to={mainEntry.to}
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
        </Link>

        <section className="eq-learning-hub-rpg-grid" aria-label="学習メニュー">
          {moduleEntries.map((entry) => (
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
