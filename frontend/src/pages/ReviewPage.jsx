import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useChildren } from '../ChildrenContext';
import {
  EQBottomNav,
  EQMobileShell,
  EQPanel,
} from '../components/eigo';
import { getEikenRealExamWrongQuestions, getGrammarQuizWrongQuestions, getVocabWrongReviews } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const reviewEntries = [
  {
    key: 'words',
    title: '単語の復習',
    subtitle: 'まちがえた単語をもう一度チェック',
    typeLabel: '単語',
    icon: '/assets/eigo-quest/review/review-icon-vocab.png',
    to: '/review/words',
  },
  {
    key: 'grammar',
    title: '文法の復習',
    subtitle: '文法テストでまちがえた問題をやり直す',
    typeLabel: '文法',
    icon: '/assets/eigo-quest/review/review-icon-grammar.png',
    to: '/review/grammar',
  },
  {
    key: 'eiken',
    title: '英検の復習',
    subtitle: '英検本番形式でまちがえた問題を見直す',
    typeLabel: '英検',
    icon: '/assets/eigo-quest/review/review-icon-eiken.png',
    to: '/review/eiken',
  },
];

export default function ReviewPage() {
  const { selectedChildId: currentChildId } = useChildren();
  const selectedChildId = currentChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const [counts, setCounts] = useState({ words: null, grammar: null, eiken: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedChildId) {
      setCounts({ words: null, grammar: null, eiken: null });
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    Promise.allSettled([
      getVocabWrongReviews(selectedChildId),
      getGrammarQuizWrongQuestions(selectedChildId),
      getEikenRealExamWrongQuestions(selectedChildId),
    ])
      .then(([wordResult, grammarResult, eikenResult]) => {
        if (!active) return;
        const wordPayload = wordResult.status === 'fulfilled' ? wordResult.value || {} : {};
        const grammarPayload = grammarResult.status === 'fulfilled' ? grammarResult.value || {} : {};
        const eikenPayload = eikenResult.status === 'fulfilled' ? eikenResult.value || {} : {};
        setCounts({
          words: (wordPayload.wrongReviews || wordPayload.wrong_reviews || []).length,
          grammar: (grammarPayload.wrongQuestions || grammarPayload.wrong_questions || []).length,
          eiken: eikenResult.status === 'fulfilled'
            ? (eikenPayload.wrongQuestions || eikenPayload.wrong_questions || []).length
            : null,
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

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="eq-review-content">
          {error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : null}

          <div className="eq-review-card-list">
            {reviewEntries.map((entry) => {
              const count = counts[entry.key];
              const countValue = Number(count || 0);
              const canReview = !loading && countValue > 0 && Boolean(entry.to);
              const statusText = loading ? '...' : count === null ? '-' : `${countValue} 問`;
              const actionText = canReview ? '復習する' : loading ? '確認中' : count === null ? '準備中' : 'クリア';
              const ActionComponent = canReview ? Link : 'button';
              const actionProps = canReview
                ? { to: entry.to, 'aria-label': `${entry.title}を開く` }
                : { type: 'button', disabled: true, 'aria-disabled': 'true' };

              return (
                <article
                  key={entry.key}
                  className={`eq-review-entry-card is-${entry.key}`}
                >
                  <span className="eq-review-card-icon" aria-hidden="true">
                    <img src={entry.icon} alt="" />
                  </span>
                  <div className="eq-review-card-main">
                    <div className="eq-review-card-head">
                      <h2>{entry.title}</h2>
                      <div className="eq-review-card-pills">
                        <span>{entry.typeLabel}</span>
                        <span>{statusText}</span>
                      </div>
                    </div>
                    <p>{entry.subtitle}</p>
                    <ActionComponent className="eq-review-card-action" {...actionProps}>
                      {actionText}
                    </ActionComponent>
                  </div>
                </article>
              );
            })}
          </div>
        </motion.section>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
