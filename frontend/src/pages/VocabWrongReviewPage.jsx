import { useEffect, useState } from 'react';
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
} from '../components/eigo';
import { getVocabWrongReviews } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const normalizeWrongReviews = (payload) => payload?.wrongReviews || payload?.wrong_reviews || [];

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function VocabWrongReviewPage() {
  const { selectedChildId: currentChildId } = useChildren();
  const childId = currentChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const [wrongReviews, setWrongReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadWrongReviews = async () => {
      if (!childId) {
        setWrongReviews([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const payload = await getVocabWrongReviews(childId);
        if (active) setWrongReviews(normalizeWrongReviews(payload));
      } catch (err) {
        if (active) {
          setWrongReviews([]);
          setError(err.message || '単語の復習リストを読み込めませんでした。');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadWrongReviews();
    return () => {
      active = false;
    };
  }, [childId]);

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-vocab-review-screen">
        <EQPageHeader
          eyebrow="Word Review"
          title="単語の復習"
          subtitle="まちがえた単語をもう一度チェック"
          icon="W"
        />

        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <EQPrimaryButton as={Link} to="/review">
              復習メニューへ
            </EQPrimaryButton>
            <EQBadge tone="gold">{loading ? '確認中' : `${wrongReviews.length} 問`}</EQBadge>
          </div>

          {error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : null}

          {loading ? (
            <EQPanel tone="cyan">
              <p className="eq-caption text-center">単語の復習リストを確認中...</p>
            </EQPanel>
          ) : wrongReviews.length === 0 ? (
            <EQPanel title="まだ復習する単語はありません。" tone="green">
              <p className="eq-caption">Stage Quizでまちがえた単語がここに表示されます。</p>
            </EQPanel>
          ) : (
            <div className="grid gap-3">
              {wrongReviews.map((item) => {
                const vocabId = item.vocabId || item.vocab_id;
                const meaning = item.meaningJa || item.meaning_ja || '';
                const wrongCount = Number(item.wrongCount || item.wrong_count || 0);
                const lastWrongAt = item.lastWrongAt || item.last_wrong_at;
                return (
                  <EQPanel key={`${vocabId}-${lastWrongAt || ''}`} tone="gold" className="eq-vocab-review-item">
                    <div className="grid gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-black text-[#ffe58f]">{item.word || vocabId}</h2>
                          <p className="mt-1 text-sm font-black text-slate-100">{meaning || '-'}</p>
                        </div>
                        <EQBadge tone="rose">{wrongCount}回</EQBadge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.partOfSpeech || item.part_of_speech ? (
                          <EQBadge tone="cyan">{item.partOfSpeech || item.part_of_speech}</EQBadge>
                        ) : null}
                        <EQBadge tone="gold">{formatDate(lastWrongAt)}</EQBadge>
                      </div>
                      <EQPrimaryButton as={Link} to={`/review/words?word=${encodeURIComponent(item.word || '')}&vocabId=${encodeURIComponent(vocabId || '')}`}>
                        復習する
                      </EQPrimaryButton>
                    </div>
                  </EQPanel>
                );
              })}
            </div>
          )}
        </motion.section>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
