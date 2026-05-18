import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getEikenRealExamPart, getEikenRealExams, submitEikenRealExamAttempt } from '../api';
import { useChildren } from '../ChildrenContext';

const CHILD_STORAGE_KEY = 'selected_child_id';

function getDefaultPart(exam, mode) {
  const parts = mode === 'written' ? exam?.written_parts : exam?.listening_parts;
  return parts?.[0]?.part_id || '';
}

function getPartList(exam, mode) {
  return mode === 'written' ? exam?.written_parts || [] : exam?.listening_parts || [];
}

function getBaseUrl() {
  return import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
}

function getEikenImageSrc(imagePath) {
  if (!imagePath) return null;
  const value = imagePath.trim();
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const cleanPath = value
    .split(/[?#]/)[0]
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^public\//, '')
    .replace(/^app\//, '')
    .replace(/^api\/eiken-real-exams\/assets\//, '')
    .replace(/^eiken\/images\//, '')
    .replace(/^png\//, '');
  const fileName = cleanPath.split('/').filter(Boolean).pop();
  return fileName ? `${getBaseUrl()}eiken/images/${encodeURIComponent(fileName)}` : null;
}

function getEikenAudioSrc(audioPath) {
  if (!audioPath) return null;
  const value = audioPath.trim();
  if (/^(data:|blob:)/i.test(value)) return value;
  const cleanPath = value
    .split(/[?#]/)[0]
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^public\//, '')
    .replace(/^app\//, '')
    .replace(/^api\/eiken-real-exams\/assets\//, '')
    .replace(/^eiken\/audio\//, '')
    .replace(/^mp3\//, '');
  const fileName = cleanPath.split('/').filter(Boolean).pop();
  return fileName ? `${getBaseUrl()}eiken/audio/${encodeURIComponent(fileName)}` : null;
}

function normalizeEikenMediaHtml(html = '') {
  return html.replace(/\b(src)=(["'])([^"']+\.(?:png|gif|jpg|jpeg|mp3|wav|m4a))(?:[?#][^"']*)?\2/gi, (match, attr, quote, value) => {
    const mediaSrc = /\.(?:mp3|wav|m4a)$/i.test(value) ? getEikenAudioSrc(value) : getEikenImageSrc(value);
    return mediaSrc ? `${attr}=${quote}${mediaSrc}${quote}` : match;
  });
}

function getQuestionAnswer(answers, questionNumber) {
  const direct = answers?.[`問${questionNumber}`];
  if (direct) return direct;
  return Object.entries(answers || {}).find(([key]) => Number(key.match(/\d+/)?.[0]) === Number(questionNumber))?.[1] || '';
}

function getQuestionNumberFromName(name = '') {
  const match = String(name).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function buildQuestionNumbers(count, fallback = []) {
  const total = Number(count || 0);
  if (total > 0) return Array.from({ length: total }, (_, index) => index + 1);
  return fallback;
}

export default function EikenRealExamPage() {
  const contentRef = useRef(null);
  const { children, selectedChildId } = useChildren();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [mode, setMode] = useState('listening');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [questionNumbers, setQuestionNumbers] = useState([]);
  const [expandedExplanations, setExpandedExplanations] = useState({});
  const [partData, setPartData] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [partLoading, setPartLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.exam_id === selectedExamId) || exams[0] || null,
    [exams, selectedExamId],
  );
  const selectedChild = useMemo(
    () => children.find((child) => String(child.id) === String(selectedChildId)) || null,
    [children, selectedChildId],
  );
  const parts = useMemo(() => getPartList(selectedExam, mode), [selectedExam, mode]);
  const questionCount = partData?.question_count || 0;
  const visibleQuestionNumbers = questionNumbers.length > 0 ? questionNumbers : buildQuestionNumbers(questionCount);
  const normalizedHtml = useMemo(() => normalizeEikenMediaHtml(partData?.html || ''), [partData?.html]);
  const audioSources = useMemo(
    () => (partData?.audio_paths || []).map(getEikenAudioSrc).filter(Boolean),
    [partData?.audio_paths],
  );
  const explanations = result?.explanations || [];

  useEffect(() => {
    let active = true;
    getEikenRealExams()
      .then((payload) => {
        if (!active) return;
        const list = payload.exams || [];
        const firstExam = list[0] || null;
        setExams(list);
        setSelectedExamId(firstExam?.exam_id || '');
        setSelectedPartId(getDefaultPart(firstExam, 'listening'));
      })
      .catch((err) => setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    setSelectedPartId(getDefaultPart(selectedExam, mode));
  }, [selectedExam, mode]);

  useEffect(() => {
    if (!selectedPartId) {
      setPartData(null);
      return;
    }
    let active = true;
    setPartLoading(true);
    setError('');
    setAnsweredCount(0);
    setAnswers({});
    setResult(null);
    setCurrentQuestion(1);
    setExpandedExplanations({});
    setStartedAt(new Date().toISOString());
    getEikenRealExamPart(selectedPartId)
      .then((payload) => {
        if (!active) return;
        setPartData(payload);
      })
      .catch((err) => setError(err.message))
      .finally(() => active && setPartLoading(false));
    return () => {
      active = false;
    };
  }, [selectedPartId]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return undefined;
    const updateAnsweredCount = () => {
      const discoveredQuestions = Array.from(
        new Set(
          Array.from(element.querySelectorAll('input[type="radio"]'))
            .map((input) => getQuestionNumberFromName(input.name))
            .filter(Boolean),
        ),
      ).sort((a, b) => a - b);
      setQuestionNumbers(buildQuestionNumbers(questionCount, discoveredQuestions));

      element.querySelectorAll('table.form > tbody > tr').forEach((row) => {
        const questionNumber = getQuestionNumberFromName(row.querySelector('input[type="radio"]')?.name || '');
        if (!questionNumber) return;
        row.dataset.eikenQuestionNumber = String(questionNumber);
        row.classList.add('eiken-question-row');
      });

      const names = new Set(
        Array.from(element.querySelectorAll('input[type="radio"]'))
          .map((input) => input.name)
          .filter(Boolean),
      );
      const checkedNames = new Set(
        Array.from(element.querySelectorAll('input[type="radio"]:checked'))
          .map((input) => input.name)
          .filter(Boolean),
      );
      const nextAnswers = {};
      element.querySelectorAll('input[type="radio"]:checked').forEach((input) => {
        nextAnswers[input.name] = input.value;
      });
      setAnsweredCount(Math.min(checkedNames.size, names.size));
      setAnswers(nextAnswers);
    };
    updateAnsweredCount();
    element.addEventListener('change', updateAnsweredCount);
    return () => element.removeEventListener('change', updateAnsweredCount);
  }, [partData?.part_id, questionCount, result]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    element.querySelectorAll('.eiken-question-row').forEach((row) => {
      const rowQuestion = Number(row.dataset.eikenQuestionNumber || 0);
      row.hidden = !result && rowQuestion !== currentQuestion;
    });
  }, [currentQuestion, result, normalizedHtml]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !result?.answer_key_available) return;
    const correctAnswers = result.correct_answers || {};
    element.querySelectorAll('td').forEach((cell) => {
      cell.classList.remove('eiken-answer-correct', 'eiken-answer-wrong', 'eiken-answer-right-key');
    });
    element.querySelectorAll('input[type="radio"]').forEach((input) => {
      const cell = input.closest('td');
      if (!cell) return;
      const correctAnswer = correctAnswers[input.name];
      if (input.value === correctAnswer) {
        cell.classList.add('eiken-answer-right-key');
      }
      if (input.checked && input.value === correctAnswer) {
        cell.classList.add('eiken-answer-correct');
      }
      if (input.checked && input.value !== correctAnswer) {
        cell.classList.add('eiken-answer-wrong');
      }
    });
  }, [result]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return undefined;
    const cleanups = Array.from(element.querySelectorAll('img')).map((image) => {
      image.alt = image.alt || '問題画像';
      const handleError = () => {
        const failedSrc = image.getAttribute('src') || '';
        console.warn('Failed to load Eiken image:', failedSrc);
        image.style.display = 'none';
        if (image.nextElementSibling?.dataset?.eikenImageFallback === 'true') return;
        const fallback = document.createElement('div');
        fallback.dataset.eikenImageFallback = 'true';
        fallback.className = 'rounded-[18px] bg-[#f8fbff] px-4 py-5 text-center text-sm font-bold text-[#6f7da8]';
        fallback.textContent = '画像を読み込めませんでした';
        image.insertAdjacentElement('afterend', fallback);
      };
      image.addEventListener('error', handleError);
      if (image.complete && image.naturalWidth === 0) {
        handleError();
      }
      return () => image.removeEventListener('error', handleError);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [normalizedHtml]);

  const resetAnswers = () => {
    const element = contentRef.current;
    element?.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.checked = false;
    });
    setAnsweredCount(0);
    setAnswers({});
    setResult(null);
    setCurrentQuestion(1);
    setExpandedExplanations({});
  };

  const goToQuestion = (questionNumber) => {
    setCurrentQuestion(questionNumber);
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goToPreviousQuestion = () => {
    const currentIndex = visibleQuestionNumbers.indexOf(currentQuestion);
    const previousQuestion = visibleQuestionNumbers[Math.max(0, currentIndex - 1)] || currentQuestion;
    goToQuestion(previousQuestion);
  };

  const goToNextQuestion = () => {
    const currentIndex = visibleQuestionNumbers.indexOf(currentQuestion);
    const nextQuestion = visibleQuestionNumbers[Math.min(visibleQuestionNumbers.length - 1, currentIndex + 1)] || currentQuestion;
    goToQuestion(nextQuestion);
  };

  const isLastQuestion = visibleQuestionNumbers[visibleQuestionNumbers.length - 1] === currentQuestion;

  const getQuestionChipClass = (questionNumber) => {
    const selectedAnswer = getQuestionAnswer(answers, questionNumber);
    const correctAnswer = result?.correct_answers?.[`問${questionNumber}`];
    const base = 'min-h-9 rounded-full px-3 text-sm font-bold transition';
    if (result?.answer_key_available && correctAnswer) {
      return `${base} ${
        selectedAnswer === correctAnswer
          ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
      }`;
    }
    if (questionNumber === currentQuestion) return `${base} bg-[#fff2a8] text-[#26376d] ring-2 ring-[#f2cf5b]`;
    if (selectedAnswer) return `${base} bg-[#eaf7ff] text-[#2f6f9f] ring-1 ring-[#c9e8f8]`;
    return `${base} bg-white text-[#6b7ca6] ring-1 ring-[#dce9f6] hover:bg-[#f5fbff]`;
  };

  const submitAnswers = async () => {
    if (!partData?.part_id) return;
    const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
    if (!childId) {
      setError('子どもを選んでから提出してください。');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = await submitEikenRealExamAttempt({
        childId,
        partId: partData.part_id,
        answers,
        startedAt,
      });
      setResult(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentAnswer = getQuestionAnswer(answers, currentQuestion);
  const currentStatus = currentAnswer ? '回答済み' : '未回答';
  const examLabel = selectedExam?.label || '2025年第3回';
  const modeLabel = mode === 'listening' ? 'リスニング' : '筆記';

  return (
    <div className="eiken-exam-page mx-auto max-w-[1440px] px-4 pb-32 pt-4 text-[#26376d] lg:px-6 lg:py-6">
      <header className="mb-4 rounded-[24px] border border-white/80 bg-white/88 px-4 py-3 shadow-[0_14px_34px_rgba(129,164,199,0.14)] backdrop-blur lg:mb-6 lg:flex lg:min-h-[68px] lg:items-center lg:justify-between lg:px-5">
        <Link to="/app" className="text-sm font-bold text-[#52668c] transition hover:text-[#26376d]">
          ← ホームに戻る
        </Link>
        <div className="mt-2 lg:mt-0 lg:text-center">
          <p className="text-xs font-bold text-[#7d8db5]">英検準2級</p>
          <h1 className="text-xl font-bold leading-tight text-[#26376d] lg:text-2xl">{examLabel}</h1>
          <p className="text-sm font-bold text-[#4e6d9e]">{modeLabel}</p>
        </div>
        <div className="mt-2 text-sm font-bold text-[#52668c] lg:mt-0 lg:text-right">
          <p>{selectedChild?.name || '学習中'}</p>
          <p className="text-xs text-[#7d8db5]">{result ? '採点済み' : currentStatus}</p>
        </div>
      </header>

      {error && <div className="mb-4 rounded-[18px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

      {loading || partLoading ? (
        <div className="mt-5 rounded-[24px] bg-white/80 p-8 text-center font-bold text-[#6f7da8]">問題を読み込み中...</div>
      ) : !partData ? (
        <div className="mt-5 rounded-[24px] bg-white/80 p-8 text-center font-bold text-[#6f7da8]">表示できる問題がありません。</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_300px]"
        >
          <aside className="eiken-exam-sidebar rounded-[24px] border border-white/80 bg-white/86 p-4 shadow-[0_14px_34px_rgba(129,164,199,0.13)] lg:sticky lg:top-6 lg:self-start">
            <div>
              <p className="text-xs font-bold text-[#7d8db5]">英検準2級</p>
              <h2 className="mt-1 text-lg font-bold leading-tight text-[#26376d]">{examLabel}</h2>
              <p className="mt-1 text-sm font-bold text-[#4e6d9e]">{partData.mode_label || modeLabel}</p>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold text-[#52668c]">
                年度・回
                <select
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                  className="mt-1 w-full rounded-[14px] border border-[#d5e5f6] bg-white px-3 py-2 text-sm font-bold text-[#26376d]"
                >
                  {exams.map((exam) => (
                    <option key={exam.exam_id} value={exam.exam_id}>
                      {exam.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-[#52668c]">
                Part
                <select
                  value={selectedPartId}
                  onChange={(event) => setSelectedPartId(event.target.value)}
                  className="mt-1 w-full rounded-[14px] border border-[#d5e5f6] bg-white px-3 py-2 text-sm font-bold text-[#26376d]"
                >
                  {parts.map((part) => (
                    <option key={part.part_id} value={part.part_id}>
                      {part.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[#eef7ff] p-1">
                <button
                  type="button"
                  onClick={() => setMode('listening')}
                  className={`rounded-[13px] px-2 py-2 text-xs font-bold transition ${mode === 'listening' ? 'bg-[#26376d] text-white shadow-sm' : 'text-[#52668c] hover:bg-white/70'}`}
                >
                  リスニング
                </button>
                <button
                  type="button"
                  onClick={() => setMode('written')}
                  className={`rounded-[13px] px-2 py-2 text-xs font-bold transition ${mode === 'written' ? 'bg-[#26376d] text-white shadow-sm' : 'text-[#52668c] hover:bg-white/70'}`}
                >
                  筆記
                </button>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-bold text-[#52668c]">問題ナビ</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
                {visibleQuestionNumbers.map((questionNumber) => (
                  <button
                    key={questionNumber}
                    type="button"
                    onClick={() => goToQuestion(questionNumber)}
                    className={getQuestionChipClass(questionNumber)}
                    aria-current={questionNumber === currentQuestion ? 'true' : undefined}
                  >
                    {questionNumber}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-2 text-xs font-bold text-[#5d70a1]">
              <span className="rounded-full bg-[#eef8ff] px-3 py-2">問題 {questionCount || '-'} 問</span>
              <span className="rounded-full bg-[#fff7d6] px-3 py-2">回答 {answeredCount} / {questionCount || '-'}</span>
              {audioSources.length > 0 && <span className="rounded-full bg-[#eaf9ee] px-3 py-2">音声あり</span>}
            </div>

            <button type="button" onClick={resetAnswers} className="mt-6 w-full rounded-[16px] bg-white px-3 py-2.5 text-sm font-bold text-[#52668c] shadow-sm ring-1 ring-[#dce9f6] transition hover:bg-[#f8fcff]">
              最初からやり直す
            </button>
            <button
              type="button"
              onClick={submitAnswers}
              disabled={submitting || answeredCount === 0}
              className="mt-3 w-full rounded-[16px] bg-[#26376d] px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#324681] disabled:opacity-45"
            >
              {submitting ? '採点中...' : '採点する'}
            </button>
          </aside>

          <main className="mt-4 min-w-0 lg:mt-0 lg:max-w-[900px]">
            {!result ? (
              <section className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(129,164,199,0.14)] lg:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#6f7da8]">{modeLabel}</p>
                    <h2 className="text-xl font-bold text-[#26376d] lg:text-2xl">問{currentQuestion} / {questionCount || visibleQuestionNumbers.length || '-'}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${currentAnswer ? 'bg-[#eaf7ff] text-[#2f6f9f]' : 'bg-[#f4f7fb] text-[#7d8db5]'}`}>
                    {currentStatus}
                  </span>
                </div>

                {audioSources.length > 0 && mode === 'listening' && (
                  <div className="mb-4 rounded-[20px] border border-[#dce9f6] bg-[#f8fcff] p-3">
                    <p className="mb-2 text-xs font-bold text-[#52668c]">音声</p>
                    <div className="grid gap-2">
                      {audioSources.map((src, index) => (
                        <audio key={`${src}-${index}`} controls preload="metadata" src={src} className="w-full">
                          <source src={src} type="audio/mpeg" />
                        </audio>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={contentRef} className="eiken-real-content" dangerouslySetInnerHTML={{ __html: normalizedHtml }} />

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button type="button" onClick={goToPreviousQuestion} disabled={currentQuestion === visibleQuestionNumbers[0]} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#52668c] shadow-sm ring-1 ring-[#dce9f6] transition hover:bg-[#f8fcff] disabled:opacity-45">
                    前へ
                  </button>
                  {isLastQuestion ? (
                    <button type="button" onClick={submitAnswers} disabled={submitting || answeredCount === 0} className="rounded-full bg-[#26376d] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#324681] disabled:opacity-45">
                      {submitting ? '採点中...' : '採点する'}
                    </button>
                  ) : (
                    <button type="button" onClick={goToNextQuestion} className="rounded-full bg-[#ffe680] px-6 py-3 text-sm font-bold text-[#26376d] shadow-sm transition hover:bg-[#ffdc58]">
                      次へ
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_42px_rgba(129,164,199,0.14)] lg:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#6f7da8]">採点結果</p>
                    <h2 className="text-2xl font-bold text-[#26376d]">
                      {result.answer_key_available ? `正解 ${result.correct_count} / ${result.total_questions}` : '提出しました'}
                    </h2>
                    {result.answer_key_available && <p className="mt-1 text-sm font-bold text-[#52668c]">正答率 {result.score_percent}%</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={resetAnswers} className="rounded-full bg-[#ffe680] px-4 py-2 text-sm font-bold text-[#26376d] shadow-sm">もう一度やる</button>
                    <Link to="/app" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#52668c] ring-1 ring-[#dce9f6]">ホームに戻る</Link>
                  </div>
                </div>

                {result.answer_key_available ? (
                  <div className="grid gap-3">
                    {explanations.map((item) => {
                      const studentAnswer = getQuestionAnswer(answers, item.question_number);
                      const isCorrect = studentAnswer && studentAnswer === item.correct_answer;
                      const isExpanded = expandedExplanations[item.question_number];
                      return (
                        <article
                          key={item.question_number}
                          className={`rounded-[20px] border p-4 ${isCorrect ? 'border-emerald-100 bg-emerald-50/70' : 'border-rose-100 bg-rose-50/70'}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                              <span className="rounded-full bg-white px-3 py-1 text-[#26376d]">問{item.question_number}</span>
                              <span className={isCorrect ? 'text-emerald-700' : 'text-rose-700'}>{isCorrect ? '正解' : '不正解'}</span>
                              <span className="text-[#52668c]">あなた: {studentAnswer || '-'}</span>
                              <span className="text-[#52668c]">正解: {item.correct_answer}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedExplanations((prev) => ({ ...prev, [item.question_number]: !prev[item.question_number] }))}
                              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#52668c] ring-1 ring-[#dce9f6]"
                            >
                              {isExpanded ? '閉じる' : '解説を見る'}
                            </button>
                          </div>
                          {isExpanded && (
                            <div
                              className="eiken-answer-explanation mt-3 rounded-[16px] bg-white/88 px-3 py-3 text-sm leading-7 text-[#42557f]"
                              dangerouslySetInnerHTML={{ __html: normalizeEikenMediaHtml(item.html || '') }}
                            />
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[20px] bg-[#f8fcff] p-4 text-sm font-bold leading-7 text-[#52668c]">
                    答えを保存しました。このパートの解答表が登録されると、自動採点できます。
                  </div>
                )}
              </section>
            )}
          </main>

          <aside className="hidden rounded-[24px] border border-white/80 bg-white/86 p-4 shadow-[0_14px_34px_rgba(129,164,199,0.13)] lg:sticky lg:top-6 lg:block lg:self-start">
            {!result ? (
              <div>
                <p className="text-xs font-bold text-[#7d8db5]">今日の進み具合</p>
                <h2 className="mt-2 text-2xl font-bold text-[#26376d]">{answeredCount} / {questionCount || '-'}</h2>
                <div className="mt-4 rounded-[18px] bg-[#f8fcff] p-4 text-sm font-bold text-[#52668c]">
                  <p>現在の問題: 問{currentQuestion}</p>
                  <p className="mt-1">状態: {currentStatus}</p>
                  <p className="mt-3 text-xs leading-6 text-[#6f7da8]">まず選択肢を読んでから音声を聞こう。</p>
                </div>
                <div className="mt-4 rounded-[18px] bg-[#fff8d9] p-4 text-sm font-bold text-[#6f628e]">採点前</div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-[#7d8db5]">採点結果</p>
                <h2 className="mt-2 text-2xl font-bold text-[#26376d]">
                  {result.answer_key_available ? `${result.correct_count} / ${result.total_questions}` : `${answeredCount} 問提出`}
                </h2>
                {result.answer_key_available && <p className="mt-1 text-sm font-bold text-[#52668c]">正答率 {result.score_percent}%</p>}
                {result.wrong_questions?.length > 0 && (
                  <div className="mt-4 rounded-[18px] bg-rose-50/80 p-4">
                    <p className="text-sm font-bold text-rose-700">間違えた問題</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.wrong_questions.map((item) => (
                        <button key={item.question_number} type="button" onClick={() => goToQuestion(item.question_number)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
                          問{item.question_number}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setExpandedExplanations(Object.fromEntries(explanations.map((item) => [item.question_number, true])))} className="mt-4 w-full rounded-[16px] bg-[#26376d] px-4 py-3 text-sm font-bold text-white shadow-sm">
                  間違い直しをする
                </button>
              </div>
            )}
          </aside>
        </motion.div>
      )}
    </div>
  );
}
