import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
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
import { getVocabWrongReviewQuestion, getVocabWrongReviews } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const normalizeWrongReviews = (payload) => payload?.wrongReviews || payload?.wrong_reviews || [];

export default function VocabWrongReviewPage() {
  const { selectedChildId: currentChildId } = useChildren();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const childId = currentChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const isQuestionMode = location.pathname.endsWith('/question');
  const vocabId = searchParams.get('vocabId') || searchParams.get('vocab_id') || '';
  const [wrongReviews, setWrongReviews] = useState([]);
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!childId) {
        setWrongReviews([]);
        setQuestion(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      setSelectedAnswer('');
      setAnswerResult(null);
      try {
        if (isQuestionMode) {
          if (!vocabId) throw new Error('vocabId is required');
          const payload = await getVocabWrongReviewQuestion({ childId, vocabId });
          if (active) setQuestion(payload);
        } else {
          const payload = await getVocabWrongReviews(childId);
          if (active) setWrongReviews(normalizeWrongReviews(payload));
        }
      } catch (err) {
        if (active) {
          setWrongReviews([]);
          setQuestion(null);
          setError(err.message || '単語の復習リストを読み込めませんでした。');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [childId, isQuestionMode, vocabId]);

  const submitAnswer = () => {
    if (!selectedAnswer || !question) return;
    const correctAnswer = question.correctAnswer || question.correct_answer;
    setAnswerResult({
      correct: selectedAnswer === correctAnswer,
      correctAnswer,
    });
  };

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-vocab-review-screen">
        <EQPageHeader
          eyebrow="Word Review"
          title={isQuestionMode ? '単語復習' : '単語の復習'}
          subtitle={isQuestionMode ? '1問だけ集中してチェック' : 'まちがえた単語をもう一度チェック'}
          icon="W"
        />

        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <EQPrimaryButton as={Link} to={isQuestionMode ? '/review/words' : '/review'}>
              {isQuestionMode ? '単語リストへ' : '復習メニューへ'}
            </EQPrimaryButton>
            <EQBadge tone="gold">{loading ? '確認中' : isQuestionMode ? '1 問' : `${wrongReviews.length} 問`}</EQBadge>
          </div>

          {error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : null}

          {loading ? (
            <EQPanel tone="cyan">
              <p className="eq-caption text-center">単語の復習を準備中...</p>
            </EQPanel>
          ) : isQuestionMode && question ? (
            <EQPanel tone="gold" className="eq-vocab-review-question">
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <EQBadge tone="cyan">{question.questionType || question.question_type}</EQBadge>
                  <h2 className="text-xl font-black text-[#ffe58f]">{question.prompt}</h2>
                </div>
                <div className="grid gap-3">
                  {(question.choices || []).map((choice, index) => {
                    const selected = selectedAnswer === choice;
                    const isCorrect = answerResult && choice === (question.correctAnswer || question.correct_answer);
                    const isWrong = answerResult && selected && !answerResult.correct;
                    return (
                      <button
                        key={`${choice}-${index}`}
                        type="button"
                        onClick={() => !answerResult && setSelectedAnswer(choice)}
                        disabled={Boolean(answerResult)}
                        className={[
                          'w-full box-border rounded-2xl border px-4 py-4 text-left text-base font-black transition',
                          'border-[rgba(255,211,90,0.58)] bg-[rgba(8,23,62,0.88)] text-slate-100',
                          selected ? 'ring-2 ring-[#ffe58f]' : '',
                          isCorrect ? 'border-emerald-300 bg-emerald-900/50 text-emerald-100' : '',
                          isWrong ? 'border-rose-300 bg-rose-900/50 text-rose-100' : '',
                        ].join(' ')}
                      >
                        <span className="mr-3 text-[#ffe58f]">({index + 1})</span>
                        {choice}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={!selectedAnswer || Boolean(answerResult)}
                  className="eq-gold-button eq-fantasy-button eq-fantasy-primary-button w-full"
                >
                  <span>答えを送信</span>
                </button>
                {answerResult ? (
                  <EQPanel tone={answerResult.correct ? 'green' : 'rose'}>
                    <p className="text-sm font-black text-slate-100">
                      {answerResult.correct ? '正解です！' : `もう一度確認しよう。正解：${answerResult.correctAnswer}`}
                    </p>
                  </EQPanel>
                ) : null}
              </div>
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
                return (
                  <EQPanel key={`${vocabId}-${item.word || ''}`} tone="gold" className="eq-vocab-review-item">
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
                      </div>
                      <Link
                        to={`/review/words/question?vocabId=${encodeURIComponent(vocabId || '')}`}
                        className="eq-gold-button eq-fantasy-button eq-fantasy-primary-button w-full"
                      >
                        <span>復習する</span>
                      </Link>
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
