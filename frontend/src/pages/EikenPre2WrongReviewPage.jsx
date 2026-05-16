import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import WrongQuestionCard from '../components/WrongQuestionCard';
import { getChildren, getEikenPre2WrongQuestions, submitEikenPre2Attempt } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';
export default function EikenPre2WrongReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(params.get('student_id') || localStorage.getItem(CHILD_STORAGE_KEY) || '');
  const [questionType, setQuestionType] = useState('');
  const [weakPointTag, setWeakPointTag] = useState('');
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [practiceSetId, setPracticeSetId] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const didInitialLoad = useRef(false);

  const setIds = useMemo(() => [...new Set(wrongQuestions.map((item) => item.set_id))], [wrongQuestions]);
  const weakPointTags = useMemo(
    () => [...new Set(wrongQuestions.map((item) => item.weak_point_tag).filter(Boolean))],
    [wrongQuestions],
  );
  const practiceQuestions = useMemo(
    () => wrongQuestions.filter((item) => !practiceSetId || item.set_id === practiceSetId),
    [practiceSetId, wrongQuestions],
  );
  const currentQuestion = practiceQuestions[currentIndex] || null;

  const loadWrongQuestions = async (childId = selectedChildId, type = questionType, weakTag = weakPointTag) => {
    if (!childId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await getEikenPre2WrongQuestions({
        studentId: childId,
        latestOnly: true,
        questionType: type || undefined,
        weakPointTag: weakTag || undefined,
      });
      const items = payload.wrong_questions || [];
      setWrongQuestions(items);
      setPracticeSetId(items[0]?.set_id || '');
      setCurrentIndex(0);
      setAnswers({});
      setLocked(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getChildren()
      .then((payload) => {
        if (!active) return;
        const childList = payload.children || [];
        setChildren(childList);
        const initialId = selectedChildId || (childList[0]?.id ? String(childList[0].id) : '');
        setSelectedChildId(initialId);
        if (initialId) {
          localStorage.setItem(CHILD_STORAGE_KEY, initialId);
          didInitialLoad.current = true;
          loadWrongQuestions(initialId, questionType);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    localStorage.setItem(CHILD_STORAGE_KEY, selectedChildId);
  }, [selectedChildId]);

  useEffect(() => {
    if (!selectedChildId || !didInitialLoad.current) return;
    loadWrongQuestions(selectedChildId, questionType, weakPointTag);
  }, [selectedChildId, questionType, weakPointTag]);

  const chooseAnswer = (option) => {
    if (!currentQuestion || locked) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: option }));
    setLocked(true);
  };

  const moveNext = () => {
    setLocked(false);
    setCurrentIndex((index) => Math.min(practiceQuestions.length - 1, index + 1));
  };

  const submitReview = async () => {
    if (!selectedChildId || !practiceSetId || practiceQuestions.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitEikenPre2Attempt({
        studentId: selectedChildId,
        setId: practiceSetId,
        answers,
        questionIds: practiceQuestions.map((item) => item.question_id),
        startedAt: new Date().toISOString(),
      });
      navigate(`/eiken-pre2/result/${encodeURIComponent(result.attempt_id)}`, { state: { result } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="まちがい復習" />

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel px-5 py-5 sm:px-7">
        <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef8ff_0%,#e3f3ff_100%)] p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7d8db5]">REVIEW</p>
              <h2 className="display-font mt-2 text-2xl font-extrabold text-[#354172]">最近まちがえた問題</h2>
            </div>
            <label className="text-sm font-bold text-[#52668c]">
              子ども
              <select
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
                className="mt-1 w-full rounded-full border border-white/80 bg-white/88 px-4 py-3 font-bold text-[#354172]"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold text-[#52668c]">
              形式
              <select
                value={questionType}
                onChange={(event) => setQuestionType(event.target.value)}
                className="mt-1 w-full rounded-full border border-white/80 bg-white/88 px-4 py-3 font-bold text-[#354172]"
              >
                <option value="">すべて</option>
                <option value="sentence_fill">短句填空</option>
                <option value="dialogue_completion">対話完成</option>
                <option value="reading">読解</option>
              </select>
            </label>
            <label className="text-sm font-bold text-[#52668c]">
              弱点
              <select
                value={weakPointTag}
                onChange={(event) => setWeakPointTag(event.target.value)}
                className="mt-1 w-full rounded-full border border-white/80 bg-white/88 px-4 py-3 font-bold text-[#354172]"
              >
                <option value="">すべて</option>
                {weakPointTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => loadWrongQuestions()} disabled={loading || !selectedChildId} className="pill-button px-5 py-3 disabled:opacity-50">
              表示
            </button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-[22px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        {loading ? (
          <div className="mt-5 rounded-[24px] bg-white/76 p-6 text-center font-bold text-[#6f7da8]">錯題を読み込み中...</div>
        ) : wrongQuestions.length === 0 ? (
          <div className="mt-5 rounded-[24px] bg-white/76 p-6 text-center text-sm font-bold leading-7 text-[#6f7da8]">
            まだ復習する錯題はありません。
            <div className="mt-4">
              <Link to="/eiken-pre2" className="pill-button inline-block px-5 py-3">もぎテストへ</Link>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#fff2bb] px-4 py-2 text-sm font-black text-[#69557e]">
                {wrongQuestions.length} 問
              </span>
              {setIds.length > 1 && (
                <label className="text-sm font-bold text-[#52668c]">
                  練習セット
                  <select
                    value={practiceSetId}
                    onChange={(event) => {
                      setPracticeSetId(event.target.value);
                      setCurrentIndex(0);
                      setAnswers({});
                      setLocked(false);
                    }}
                    className="ml-2 rounded-full border border-white/80 bg-white/88 px-4 py-2 font-bold text-[#354172]"
                  >
                    {setIds.map((setId) => (
                      <option key={setId} value={setId}>{setId}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {currentQuestion && (
              <>
                <WrongQuestionCard
                  question={currentQuestion}
                  mode="practice"
                  selectedAnswer={answers[currentQuestion.question_id]}
                  locked={locked}
                  onSelect={chooseAnswer}
                />

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setLocked(false);
                      setCurrentIndex((index) => Math.max(0, index - 1));
                    }}
                    disabled={currentIndex === 0}
                    className="ghost-button px-5 py-3 disabled:opacity-40"
                  >
                    前へ
                  </button>
                  {currentIndex < practiceQuestions.length - 1 ? (
                    <button type="button" onClick={moveNext} className="pill-button px-5 py-3">次へ</button>
                  ) : (
                    <button type="button" onClick={submitReview} disabled={submitting || Object.keys(answers).length !== practiceQuestions.length} className="pill-button px-5 py-3 disabled:opacity-40">
                      {submitting ? '保存中...' : Object.keys(answers).length === practiceQuestions.length ? '復習結果を保存' : '全部答えたら保存'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
}
