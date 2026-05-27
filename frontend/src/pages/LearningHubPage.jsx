import { Link } from 'react-router-dom';
import {
  EQBadge,
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
  EQQuestCard,
} from '../components/eigo';

const mainEntry = {
  title: '単語学習',
  subtitle: '単語テスト、文法の神殿へ進もう',
  status: '未完了',
  reward: '英語カード収集',
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
    subtitle: '今日の記録をチェック',
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
    icon: 'G',
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
    title: '単語辞書館',
    subtitle: '覚えた単語を見返す',
    status: '378 words',
    reward: 'コレクション',
    to: '/learned-words',
    icon: '本',
    tone: 'sky',
  },
];

function EntryBadges({ entry }) {
  return (
    <>
      <EQBadge tone={entry.tone}>{entry.status}</EQBadge>
      <EQBadge tone={entry.tone}>{entry.reward}</EQBadge>
    </>
  );
}

export default function LearningHubPage() {
  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <EQPageHeader
          eyebrow="Learning Hub"
          title="学習"
          subtitle="今日のクエストを選ぼう"
          icon="★"
        />

        <EQQuestCard
          as={Link}
          to={mainEntry.to}
          featured
          tone={mainEntry.tone}
          icon={mainEntry.icon}
          title={mainEntry.title}
          subtitle={mainEntry.subtitle}
          badges={<EntryBadges entry={mainEntry} />}
          action={
            <EQPrimaryButton as="span" fullWidth>
              Start
            </EQPrimaryButton>
          }
          aria-label={`${mainEntry.title}へ`}
        />

        <EQPanel className="eq-learning-hub-module-panel" title="クエスト" eyebrow="Choose Path">
          <section className="eq-learning-hub-grid" aria-label="学習メニュー">
            {moduleEntries.map((entry) => (
              <EQQuestCard
                key={entry.to}
                as={Link}
                to={entry.to}
                tone={entry.tone}
                icon={entry.icon}
                title={entry.title}
                subtitle={entry.subtitle}
                badges={<EntryBadges entry={entry} />}
                aria-label={`${entry.title}へ`}
              />
            ))}
          </section>
        </EQPanel>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
