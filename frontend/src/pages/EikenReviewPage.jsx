import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import {
  getEikenRealExamPart,
  getEikenRealExamWrongQuestions,
  submitEikenRealExamReviewAnswer,
} from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const normalizeWrongQuestions = (payload) => payload?.wrongQuestions || payload?.wrong_questions || [];

const formatAnswer = (answer) => answer || '未回答';

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

function getQuestionNumberFromName(name = '') {
  const match = String(name).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeEikenMediaHtml(html = '') {
  return html.replace(/\b(src)=(["'])([^"']+\.(?:png|gif|jpg|jpeg|mp3|wav|m4a))(?:[?#][^"']*)?\2/gi, (match, attr, quote, value) => {
    if (/^(https?:|data:|blob:|\/api\/)/i.test(value)) return match;
    const cleanPath = value
      .split(/[?#]/)[0]
      .replace(/\\/g, '/')
      .replace(/^\.?\//, '')
      .replace(/^public\//, '')
      .replace(/^app\//, '');
    return `${attr}=${quote}/api/eiken-real-exams/assets/${cleanPath}${quote}`;
  });
}

function buildReviewQuestionPath(item) {
  const partId = item.partId || item.part_id;
  const questionNumber = item.questionNumber || item.question_number;
  return `/review/eiken/question?partId=${encodeURIComponent(partId)}&question=${encodeURIComponent(questionNumber)}`;
}

function EikenWrongQuestionCard({ item }) {
  const partId = item.partId || item.part_id || '-';
  const questionNumber = item.questionNumber || item.question_number || '-';
  const studentAnswer = item.studentAnswer || item.student_answer || item.selectedAnswer || item.selected_answer;
  const correctAnswer = item.correctAnswer || item.correct_answer;
  const createdAt = item.createdAt || item.created_at || item.answeredAt || item.answered_at;
  const attemptId = item.attemptId || item.attempt_id;

  return (
    <EQPanel tone="gold" className="eq-eiken-review-item">
      <Link to={buildReviewQuestionPath(item)} className="eq-eiken-review-card-link" aria-label={`問${questionNumber}を復習する`}>
        <div className="flex flex-wrap gap-2">
          <EQBadge tone="gold">Part {partId}</EQBadge>
          <EQBadge tone="cyan">Q{questionNumber}</EQBadge>
          <EQBadge tone="rose">まちがい</EQBadge>
        </div>
        <div className="grid gap-2 text-sm font-black text-slate-100">
          <p>選んだ答え: {formatAnswer(studentAnswer)}</p>
          <p>正解: {formatAnswer(correctAnswer)}</p>
          <p className="eq-caption">
            {formatDate(createdAt) || `Attempt ${attemptId}`}
          </p>
        </div>
        <span className="eq-eiken-review-card-action">復習する</span>
      </Link>
    </EQPanel>
  );
}

function EikenReviewQuestion({
  childId,
  partId,
  questionNumber,
  wrongQuestions,
  onResolved,
}) {
  const contentRef = useRef(null);
  const [partData, setPartData] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const wrongQuestion = useMemo(() => {
    const targetQuestion = Number(questionNumber);
    return wrongQuestions.find((item) => {
      const itemPartId = item.partId || item.part_id;
      const itemQuestion = Number(item.questionNumber || item.question_number);
      return itemPartId === partId && itemQuestion === targetQuestion;
    }) || null;
  }, [partId, questionNumber, wrongQuestions]);

  const previousAnswer = wrongQuestion?.studentAnswer || wrongQuestion?.student_answer || wrongQuestion?.selectedAnswer || wrongQuestion?.selected_answer || '';
  const correctAnswer = wrongQuestion?.correctAnswer || wrongQuestion?.correct_answer || '';
  const normalizedHtml = useMemo(() => normalizeEikenMediaHtml(partData?.html || ''), [partData?.html]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getEikenRealExamPart(partId)
      .then((payload) => {
        if (active) setPartData(payload);
      })
      .catch((err) => {
        if (active) setError(err.message || '問題を読み込めませんでした。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [partId]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return undefined;

    element.querySelectorAll('table.form > tbody > tr, table.form > tr').forEach((row) => {
      const rowQuestion = getQuestionNumberFromName(row.querySelector('input[type="radio"]')?.name || '');
      if (!rowQuestion) return;
      row.dataset.eikenQuestionNumber = String(rowQuestion);
      row.hidden = rowQuestion !== Number(questionNumber);
      row.classList.add('eiken-question-row');
    });

    const updateSelectedAnswer = () => {
      const checked = element.querySelector('input[type="radio"]:checked');
      setSelectedAnswer(checked?.value || '');
    };

    const selectOptionFromRow = (event) => {
      const optionCell = event.target.closest('.hpb-cnt-tb1 td');
      if (!optionCell || !element.contains(optionCell)) return;
      const radio = optionCell.querySelector('input[type="radio"]') || optionCell.closest('tr')?.querySelector('input[type="radio"]');
      if (!radio || event.target === radio) return;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    };

    element.addEventListener('change', updateSelectedAnswer);
    element.addEventListener('click', selectOptionFromRow);
    updateSelectedAnswer();
    return () => {
      element.removeEventListener('change', updateSelectedAnswer);
      element.removeEventListener('click', selectOptionFromRow);
    };
  }, [normalizedHtml, questionNumber]);

  const submitReview = async () => {
    if (!selectedAnswer || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = await submitEikenRealExamReviewAnswer({
        childId,
        partId,
        questionNumber,
        selectedAnswer,
      });
      setResult(payload);
      if (payload.isCorrect || payload.is_correct) {
        onResolved?.(partId, Number(questionNumber));
      }
    } catch (err) {
      setError(err.message || '復習結果を送信できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="eq-eiken-review-question">
      <div className="flex flex-wrap items-center gap-2">
        <EQPrimaryButton as={Link} to="/review/eiken">
          一覧へ
        </EQPrimaryButton>
        <EQBadge tone="gold">Part {partId}</EQBadge>
        <EQBadge tone="cyan">問{questionNumber}</EQBadge>
      </div>

      {error ? (
        <EQPanel title="エラー" tone="rose">
          <p className="eq-caption">{error}</p>
        </EQPanel>
      ) : null}

      {loading ? (
        <EQPanel tone="cyan">
          <p className="eq-caption text-center">原題を読み込み中...</p>
        </EQPanel>
      ) : (
        <>
          <EQPanel title="前回の答え" tone="gold">
            <div className="grid gap-2 text-sm font-black text-slate-100">
              <p>選んだ答え: {formatAnswer(previousAnswer)}</p>
              <p>正解: {formatAnswer(correctAnswer)}</p>
            </div>
          </EQPanel>

          <section className="eiken-real-trial-page eq-eiken-review-original">
            <div className="eiken-real-listening-question-card">
              <div ref={contentRef} className="eiken-real-content" dangerouslySetInnerHTML={{ __html: normalizedHtml }} />
              <div className="eq-eiken-review-submit-row">
                <button type="button" onClick={submitReview} disabled={!selectedAnswer || submitting} className="eiken-real-trial-gold-action">
                  {submitting ? '送信中...' : '答えを送信'}
                </button>
              </div>
            </div>
          </section>

          {result ? (
            <EQPanel title={(result.isCorrect || result.is_correct) ? '正解！' : 'もう一度チャレンジ'} tone={(result.isCorrect || result.is_correct) ? 'green' : 'rose'}>
              <div className="grid gap-2 text-sm font-black text-slate-100">
                <p>あなたの答え: {formatAnswer(result.selectedAnswer || result.selected_answer)}</p>
                <p>正解: {formatAnswer(result.correctAnswer || result.correct_answer)}</p>
                {(result.isCorrect || result.is_correct) ? (
                  <p className="eq-caption">この問題は復習リストから外れます。</p>
                ) : (
                  <p className="eq-caption">もう一度、本文と選択肢を確認しよう。</p>
                )}
              </div>
            </EQPanel>
          ) : null}
        </>
      )}
    </motion.section>
  );
}

export default function EikenReviewPage() {
  const { selectedChildId: currentChildId } = useChildren();
  const [searchParams] = useSearchParams();
  const childId = currentChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const partId = searchParams.get('partId') || '';
  const questionNumber = searchParams.get('question') || '';
  const isQuestionMode = Boolean(partId && questionNumber);
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

  const handleResolved = (resolvedPartId, resolvedQuestionNumber) => {
    setWrongQuestions((items) => items.filter((item) => {
      const itemPartId = item.partId || item.part_id;
      const itemQuestion = Number(item.questionNumber || item.question_number);
      return !(itemPartId === resolvedPartId && itemQuestion === Number(resolvedQuestionNumber));
    }));
  };

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
          subtitle={isQuestionMode ? '原題をもう一度解こう' : '英検本番形式でまちがえた問題'}
          icon="E"
        />

        {isQuestionMode ? (
          <EikenReviewQuestion
            childId={childId}
            partId={partId}
            questionNumber={questionNumber}
            wrongQuestions={wrongQuestions}
            onResolved={handleResolved}
          />
        ) : (
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
                  const questionNumberForKey = item.questionNumber || item.question_number || '-';
                  const attemptId = item.attemptId || item.attempt_id;
                  return (
                    <EikenWrongQuestionCard
                      key={`${attemptId}-${questionNumberForKey}-${item.id}`}
                      item={item}
                    />
                  );
                })}
              </div>
            )}
          </motion.section>
        )}
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
