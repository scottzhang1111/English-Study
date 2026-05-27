import { Link } from 'react-router-dom';
import { EQBottomNav, EQMobileShell } from '../components/eigo';

const mainEntry = {
  title: '単語学習',
  subtitle: '単語小テスト、文法の神殿へ進もう',
  status: '未完成',
  reward: '英雄カード獲得',
  to: '/daily-words',
  icon: '20',
  tone: 'gold',
};

const moduleEntries = [
  {
    title: 'まちがい復習',
    subtitle: '苦手な単語をもう一度',
    status: '12問',
    reward: '弱点クリア',
    to: '/review',
    icon: '!',
    tone: 'rose',
  },
  {
    title: '今日の復習クイズ',
    subtitle: '今日の記憶をチェック',
    status: '20問',
    reward: '復習ボーナス',
    to: '/today-review-quiz',
    icon: '?',
    tone: 'cyan',
  },
  {
    title: '文法の神殿',
    subtitle: '文法ルールを学ぶ',
    status: '今日の文法あり',
    reward: '知恵のかけら',
    to: '/grammar',
    icon: '文',
    tone: 'purple',
  },
  {
    title: '文法練習',
    subtitle: '使える形に鍛える',
    status: '8問',
    reward: '練習スタンプ',
    to: '/grammar-practice',
    icon: '✓',
    tone: 'green',
  },
  {
    title: '英検クエスト',
    subtitle: '英検対策に挑戦',
    status: '挑戦可能',
    reward: '英検メダル',
    to: '/eiken',
    icon: 'E',
    tone: 'amber',
  },
  {
    title: '英検本番形式',
    subtitle: '本番と同じ流れで練習',
    status: '模試あり',
    reward: '試験バッジ',
    to: '/eiken-real',
    icon: 'Ex',
    tone: 'blue',
  },
  {
    title: '単語図書館',
    subtitle: '覚えた単語を見返す',
    status: '378 words',
    reward: 'コレクション',
    to: '/learned-words',
    icon: '本',
    tone: 'sky',
  },
];

export default function LearningHubPage() {
  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <header className="eq-learning-hub-header">
          <span>Learning Hub</span>
          <h1>学習</h1>
          <p>今日のクエストを選ぼう</p>
        </header>

        <Link
          to={mainEntry.to}
          className={`eq-learning-hub-main is-${mainEntry.tone}`}
          aria-label={`${mainEntry.title}へ`}
        >
          <span className="eq-learning-hub-main-icon">{mainEntry.icon}</span>
          <span className="eq-learning-hub-main-copy">
            <strong>{mainEntry.title}</strong>
            <small>{mainEntry.subtitle}</small>
            <span className="eq-learning-hub-reward-label">{mainEntry.status}</span>
            <span className="eq-learning-hub-reward-label">{mainEntry.reward}</span>
          </span>
          <em>Start</em>
        </Link>

        <section className="eq-learning-hub-grid" aria-label="学習メニュー">
          {moduleEntries.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              className={`eq-learning-hub-card is-${entry.tone}`}
              aria-label={`${entry.title}へ`}
            >
              <span className="eq-learning-hub-card-icon">{entry.icon}</span>
              <strong>{entry.title}</strong>
              <small>{entry.subtitle}</small>
              <span className="eq-learning-hub-reward-label">{entry.status}</span>
              <span className="eq-learning-hub-reward-label">{entry.reward}</span>
            </Link>
          ))}
        </section>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
