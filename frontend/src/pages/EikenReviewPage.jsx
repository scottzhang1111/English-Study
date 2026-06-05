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
} from '../components/eigo';
import { getEikenRealExamWrongQuestions } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const normalizeWrongQuestions = (payload) => payload?.wrongQuestions || payload?.wrong_questions || [];

const formatAnswer = (answer) => {
  if (!answer) return '未回答';
  return answer;
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function EikenReviewPage() {
  const { selectedChildId: currentChildId } = useChildren();
  const childId = currentChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadWrongQuestions = async () => {
      if (!childId) {
        setWrongQuestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const payload = await getEikenRealExamWrongQuestions(childId);
        if (active) setWrongQuestions(normalizeWrongQuestions(payload));
      } catch (err) {
        if (active) {
          setWrongQuestions([]);
          setError(err.message || '英検の復習リストを読み込めませんでした。');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadWrongQuestions();
    return () => {
      active = false;
    };
  }, [childId]);

  const count = wrongQuestions.length;
  const progressText = useMemo(() => {
    if (loading) return '確認中';
    return `${count} 問`;
  }, [count, loading]);

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-eiken-review-screen">
        <EQPageHeader
          eyebrow="Eiken Review"
          title="英検の復習"
          subtitle="英検本番形式でまちがえた問題"
          icon="E"
        />

        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <EQPrimaryButton as={Link} to="/review">
              復習メニューへ
            </EQPrimaryButton>
            <EQBadge tone="gold">{progressText}</EQBadge>
          </div>

          {error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : null}

          {loading ? (
            <EQPanel tone="cyan">
              <p className="eq-caption text-center">英検のまちがいを確認中...</p>
            </EQPanel>
          ) : count === 0 ? (
            <EQPanel title="英検のまちがいはありません" tone="green">
              <p className="eq-caption">英検本番形式でまちがえた問題はまだありません。</p>
            </EQPanel>
          ) : (
            <div className="grid gap-3">
              {wrongQuestions.map((item) => {
                const partId = item.partId || item.part_id || '-';
                const questionNumber = item.questionNumber || item.question_number || '-';
                const studentAnswer = item.studentAnswer || item.student_answer || item.selectedAnswer || item.selected_answer;
                const correctAnswer = item.correctAnswer || item.correct_answer;
                const createdAt = item.createdAt || item.created_at || item.answeredAt || item.answered_at;
                const attemptId = item.attemptId || item.attempt_id;
                return (
                  <EQPanel
                    key={`${attemptId}-${questionNumber}-${item.id}`}
                    tone="gold"
                    className="eq-eiken-review-item"
                  >
                    <div className="flex flex-wrap gap-2">
                      <EQBadge tone="gold">Part {partId}</EQBadge>
                      <EQBadge tone="cyan">Q{questionNumber}</EQBadge>
                      <EQBadge tone="rose">まちがい</EQBadge>
                    </div>
                    <div className="grid gap-2 text-sm font-black text-slate-100">
                      <p>選んだ答え：{formatAnswer(studentAnswer)}</p>
                      <p>正解：{formatAnswer(correctAnswer)}</p>
                      <p className="eq-caption">
                        {formatDate(createdAt) || `Attempt ${attemptId}`}
                      </p>
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
