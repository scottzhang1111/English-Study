import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useChildren } from '../ChildrenContext';
import {
  EQBadge,
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
  EQQuestCard,
} from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import { getGrammarQuizWrongQuestions, getReviewList } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const reviewEntries = [
  {
    key: 'words',
    title: '単語の復習',
    subtitle: 'まちがえた単語をもう一度チェック',
    badge: '単語',
    tone: 'gold',
    icon: 'W',
    to: '/today-review-quiz',
  },
  {
    key: 'grammar',
    title: '文法の復習',
    subtitle: '文法テストでまちがえた問題をやり直す',
    badge: '文法',
    tone: 'green',
    icon: 'G',
    to: '/review/grammar',
  },
  {
    key: 'eiken',
    title: '英検の復習',
    subtitle: '英検のまちがい復習は準備中',
    badge: '準備中',
    tone: 'amber',
    icon: 'E',
    to: '',
  },
];

export default function ReviewPage() {
  const { selectedChildId: currentChildId } = useChildren();
  const selectedChildId = currentChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const [counts, setCounts] = useState({ words: null, grammar: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedChildId) {
      setCounts({ words: null, grammar: null });
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    Promise.allSettled([
      getReviewList(selectedChildId),
      getGrammarQuizWrongQuestions(selectedChildId),
    ])
      .then(([wordResult, grammarResult]) => {
        if (!active) return;
        const wordPayload = wordResult.status === 'fulfilled' ? wordResult.value || {} : {};
        const grammarPayload = grammarResult.status === 'fulfilled' ? grammarResult.value || {} : {};
        setCounts({
          words: (wordPayload.review_list || wordPayload.reviewList || []).length,
          grammar: (grammarPayload.wrongQuestions || grammarPayload.wrong_questions || []).length,
        });
        if (wordResult.status === 'rejected' && grammarResult.status === 'rejected') {
          setError(wordResult.reason?.message || grammarResult.reason?.message || '復習リストを読み込めませんでした。');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedChildId]);

  const totalCount = useMemo(
    () => Number(counts.words || 0) + Number(counts.grammar || 0),
    [counts],
  );

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <CompactPageHeader
          title="まちがい復習"
          subtitle="苦手な問題をもう一度クリアしよう"
          backgroundImage="/assets/eigo-quest/learning-hub/縺ｾ縺｡縺後＞蠕ｩ鄙・png"
          elementLabel="復習"
          progressText={loading ? '確認中' : `${totalCount} 問`}
          helperImage="/assets/eigo-quest/spirit_assets/happy.png"
          variant="review"
        />
        <EQPageHeader
          eyebrow="Wrong Review"
          title="復習メニュー"
          subtitle="復習したいジャンルを選ぼう"
          icon="!"
        />

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          {error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : null}

          <div className="grid gap-4">
            {reviewEntries.map((entry) => {
              const count = entry.key === 'eiken' ? null : counts[entry.key];
              const badges = (
                <div className="flex flex-wrap gap-2">
                  <EQBadge tone={entry.tone}>{entry.badge}</EQBadge>
                  {count !== null ? <EQBadge tone="cyan">{loading ? '...' : `${count} 問`}</EQBadge> : null}
                </div>
              );
              const action = entry.to ? (
                <EQPrimaryButton as={Link} to={entry.to}>
                  開く
                </EQPrimaryButton>
              ) : (
                <EQBadge tone="amber">準備中</EQBadge>
              );

              return (
                <EQQuestCard
                  key={entry.key}
                  tone={entry.tone}
                  icon={entry.icon}
                  title={entry.title}
                  subtitle={entry.subtitle}
                  badges={badges}
                  action={action}
                />
              );
            })}
          </div>
        </motion.section>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
