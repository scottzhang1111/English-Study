import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useChildren } from '../ChildrenContext';
import {
  EQBadge,
  EQBottomNav,
  EQMobileShell,
  EQPanel,
  EQPrimaryButton,
  EQQuestCard,
} from '../components/eigo';
import { getGrammarQuizWrongQuestions, getReviewList } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const reviewEntries = [
  {
    key: 'words',
    title: '単語の復習',
    subtitle: 'まちがえた単語をもう一度チェック',
    badge: '単語',
    tone: 'gold',
    icon: '/assets/eigo-quest/review/review-icon-vocab.png',
    iconLabel: '単語の復習',
    to: '/today-review-quiz',
  },
  {
    key: 'grammar',
    title: '文法の復習',
    subtitle: '文法テストでまちがえた問題をやり直す',
    badge: '文法',
    tone: 'green',
    icon: '/assets/eigo-quest/review/review-icon-grammar.png',
    iconLabel: '文法の復習',
    to: '/review/grammar',
  },
  {
    key: 'eiken',
    title: '英検の復習',
    subtitle: '英検のまちがい復習は準備中',
    badge: '準備中',
    tone: 'amber',
    icon: '/assets/eigo-quest/review/review-icon-eiken.png',
    iconLabel: '英検の復習',
    to: '',
  },
];

function ReviewCategoryIcon({ src, label }) {
  return (
    <span className="review-category-icon" aria-label={label} role="img">
      <img src={src} alt="" aria-hidden="true" />
    </span>
  );
}

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

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-review-screen">
        <div className="eq-review-banner" aria-hidden="true">
          <img src="/assets/eigo-quest/review/review-banner.png" alt="" />
        </div>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          {error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : null}

          <div className="grid gap-4">
            {reviewEntries.map((entry) => {
              const isEiken = entry.key === 'eiken';
              const count = isEiken ? null : counts[entry.key];
              const countValue = Number(count || 0);
              const canReview = !loading && !isEiken && countValue > 0;
              const badges = (
                <div className="flex flex-wrap gap-2">
                  <EQBadge tone={entry.tone}>{entry.badge}</EQBadge>
                  {count !== null ? <EQBadge tone="cyan">{loading ? '...' : `${count} 問`}</EQBadge> : null}
                </div>
              );
              const action = canReview ? (
                <EQPrimaryButton as={Link} to={entry.to}>
                  復習する
                </EQPrimaryButton>
              ) : isEiken ? (
                <EQPrimaryButton disabled>
                  準備中
                </EQPrimaryButton>
              ) : loading ? (
                <EQPrimaryButton disabled>
                  確認中
                </EQPrimaryButton>
              ) : (
                <EQPrimaryButton disabled>
                  クリア
                </EQPrimaryButton>
              );

              return (
                <EQQuestCard
                  key={entry.key}
                  tone={entry.tone}
                  className={`eq-review-entry-card is-${entry.key}`}
                  icon={<ReviewCategoryIcon src={entry.icon} label={entry.iconLabel} />}
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
