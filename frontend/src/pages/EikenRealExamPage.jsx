import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { EQBottomNav } from '../components/eigo';
import { getEikenRealExamPart, getEikenRealExams, submitEikenRealExamAttempt } from '../api';
import { useChildren } from '../ChildrenContext';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

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

function getCorrectAnswerForQuestion(correctAnswers, questionNumber) {
  return getQuestionAnswer(correctAnswers, questionNumber);
}

function getQuestionNumberFromName(name = '') {
  const match = String(name).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function buildQuestionNumbers(count, fallback = []) {
  if (fallback.length > 0) return fallback;
  const total = Number(count || 0);
  if (total > 0) return Array.from({ length: total }, (_, index) => index + 1);
  return [];
}

function cleanPreviewText(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .trim();
}

function shortenPreview(value = '', maxLength = 260) {
  const text = cleanPreviewText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function extractEikenQuestionPreviews(html = '', mode = 'listening') {
  if (!html || typeof DOMParser === 'undefined') return {};
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const previews = {};

  doc.querySelectorAll('table.form > tbody > tr').forEach((row) => {
    const inputs = Array.from(row.querySelectorAll('input[type="radio"]'));
    const questionNumber = getQuestionNumberFromName(inputs[0]?.name || '');
    if (!questionNumber) return;

    const choices = inputs.map((input) => {
      const rawText = cleanPreviewText(input.closest('td, th, label')?.textContent || input.value || '');
      const value = cleanPreviewText(input.value || '');
      return rawText.includes(value) ? rawText : `${value} ${rawText}`.trim();
    }).filter(Boolean);

    const clone = row.cloneNode(true);
    clone.querySelectorAll('script, style, input, button, audio').forEach((node) => node.remove());
    clone.querySelectorAll('.hpb-cnt-tb1').forEach((table) => {
      if (table.querySelector('input[type="radio"]')) table.remove();
    });
    clone.querySelectorAll('table').forEach((table) => {
      if (table.textContent && choices.some((choice) => cleanPreviewText(table.textContent).includes(choice))) table.remove();
    });

    const image = row.querySelector('img');
    const imageSrc = image?.getAttribute('src') || '';
    previews[questionNumber] = {
      questionNumber,
      mode,
      isListening: mode === 'listening' || Boolean(row.querySelector('audio')),
      summary: shortenPreview(clone.textContent || ''),
      choices: Array.from(new Set(choices)).slice(0, 4),
      imageSrc,
      hasImage: Boolean(imageSrc),
    };
  });

  return previews;
}

function EikenResultQuestionPreview({ preview, studentAnswer, correctAnswer, expanded }) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeStudentAnswer = studentAnswer || '未回答';
  const safeCorrectAnswer = correctAnswer || '正解情報なし';
  const hasPreview = preview?.summary || preview?.choices?.length || preview?.hasImage;

  if (!hasPreview) {
    return (
      <div className="mt-3 rounded-[16px] bg-white/72 p-3 text-sm font-bold text-[#60709d]">
        問題内容を表示できません
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[16px] bg-white/72 p-3 text-sm leading-6 text-[#42557f]">
      <p className="text-xs font-bold text-[#7d8db5]">問題</p>
      {preview.isListening && (
        <p className="mt-1 rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-bold text-[#52668c]">
          リスニング問題
        </p>
      )}
      {preview.hasImage && (
        <div className="mt-2">
          <p className="text-xs font-bold text-[#52668c]">画像問題</p>
          {!imageFailed ? (
            <img
              src={preview.imageSrc}
              alt="問題画像"
              onError={() => setImageFailed(true)}
              className="mt-2 max-h-40 w-full rounded-[14px] object-contain bg-[#f8fcff]"
            />
          ) : (
            <div className="mt-2 rounded-[14px] bg-[#f8fcff] px-3 py-4 text-center text-xs font-bold text-[#6f7da8]">
              画像を読み込めませんでした
            </div>
          )}
        </div>
      )}
      {preview.summary && <p className={`mt-2 whitespace-pre-line font-bold ${expanded ? '' : 'max-h-16 overflow-hidden'}`}>{preview.summary}</p>}
      {preview.choices?.length > 0 && (
        <div className="mt-3 grid gap-2">
          {preview.choices.map((choice) => {
            const isStudent = studentAnswer && choice.includes(studentAnswer);
            const isCorrect = correctAnswer && choice.includes(correctAnswer);
            const tone = isCorrect
              ? 'border-emerald-100 bg-emerald-50/80 text-emerald-800'
              : isStudent
                ? 'border-rose-100 bg-rose-50/80 text-rose-800'
                : 'border-[#e4eef8] bg-white/82 text-[#42557f]';
            return (
              <div key={choice} className={`rounded-[12px] border px-3 py-2 text-xs font-bold ${tone}`}>
                {choice}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className={studentAnswer && studentAnswer !== correctAnswer ? 'rounded-full bg-rose-50 px-3 py-1 text-rose-700' : 'rounded-full bg-emerald-50 px-3 py-1 text-emerald-700'}>
          あなた: {safeStudentAnswer}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">正解: {safeCorrectAnswer}</span>
      </div>
    </div>
  );
}

export default function EikenRealExamPage() {
  const contentRef = useRef(null);
  const { children, selectedChildId } = useChildren();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [mode, setMode] = useState('listening');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
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
  const visibleQuestionNumbers = questionNumbers.length > 0
    ? questionNumbers
    : partData?.question_numbers?.length
      ? partData.question_numbers
      : buildQuestionNumbers(questionCount);
  const normalizedHtml = useMemo(() => normalizeEikenMediaHtml(partData?.html || ''), [partData?.html]);
  const questionPreviews = useMemo(() => extractEikenQuestionPreviews(normalizedHtml, mode), [normalizedHtml, mode]);
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
    setPracticeStarted(false);
    setIsConfirming(false);
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
    element.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.checked = answers[input.name] === input.value;
    });
  }, [normalizedHtml, practiceStarted, isConfirming, result, answers]);

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
      const questionNumber = getQuestionNumberFromName(input.name);
      const correctAnswer = getCorrectAnswerForQuestion(correctAnswers, questionNumber);
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
    setPracticeStarted(false);
    setIsConfirming(false);
    setCurrentQuestion(1);
    setExpandedExplanations({});
  };

  const goToQuestion = (questionNumber) => {
    setIsConfirming(false);
    setCurrentQuestion(questionNumber);
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const startPractice = () => {
    setPracticeStarted(true);
    setIsConfirming(false);
    setCurrentQuestion(visibleQuestionNumbers[0] || 1);
  };

  const goToPreviousQuestion = () => {
    const currentIndex = visibleQuestionNumbers.indexOf(currentQuestion);
    const previousQuestion = visibleQuestionNumbers[Math.max(0, currentIndex - 1)] || currentQuestion;
    goToQuestion(previousQuestion);
  };

  const goToNextQuestion = () => {
    const currentIndex = visibleQuestionNumbers.indexOf(currentQuestion);
    if (currentIndex >= visibleQuestionNumbers.length - 1) {
      setIsConfirming(true);
      return;
    }
    const nextQuestion = visibleQuestionNumbers[Math.min(visibleQuestionNumbers.length - 1, currentIndex + 1)] || currentQuestion;
    goToQuestion(nextQuestion);
  };

  const isLastQuestion = visibleQuestionNumbers[visibleQuestionNumbers.length - 1] === currentQuestion;
  const unansweredNumbers = visibleQuestionNumbers.filter((questionNumber) => !getQuestionAnswer(answers, questionNumber));
  const unansweredCount = unansweredNumbers.length;

  const getQuestionChipClass = (questionNumber) => {
    const selectedAnswer = getQuestionAnswer(answers, questionNumber);
    const correctAnswer = getCorrectAnswerForQuestion(result?.correct_answers, questionNumber);
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
      setIsConfirming(false);
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
  const isEntryScreen = !practiceStarted && !result;
  const totalForResult = result?.total_questions || questionCount || visibleQuestionNumbers.length || 0;
  const correctForResult = result?.answer_key_available ? result.correct_count || 0 : 0;
  const scorePercent = result?.answer_key_available && totalForResult
    ? Math.round((correctForResult / totalForResult) * 100)
    : 0;
  const rankBadge = scorePercent >= 90 ? 'S' : scorePercent >= 75 ? 'A' : scorePercent >= 55 ? 'B' : 'C';
  const reviewMistakes = () => {
    const wrongNumbers = result?.wrong_questions?.map((item) => item.question_number) || [];
    const entries = wrongNumbers.length > 0
      ? wrongNumbers.map((questionNumber) => [questionNumber, true])
      : explanations.map((item) => [item.question_number, true]);
    setExpandedExplanations(Object.fromEntries(entries));
  };
  const reviewAnswers = () => {
    const targetQuestion = unansweredNumbers[0] || visibleQuestionNumbers[0] || currentQuestion;
    goToQuestion(targetQuestion);
  };
  const showAllExplanations = () => {
    setExpandedExplanations(Object.fromEntries(explanations.map((item) => [item.question_number, true])));
  };

  return (
    <div className={`eiken-exam-page eiken-real-trial-page mx-auto max-w-[1440px] px-3 pb-28 pt-2 text-[#26376d] lg:px-5 lg:py-4 ${practiceStarted && !result ? 'max-md:pb-36' : ''}`}>
      <div className="eiken-real-trial-compact-wrap md:hidden">
        <CompactPageHeader
          title={result ? '試練結果' : '英検試練'}
          subtitle={isEntryScreen ? '年度・パートを選んで挑戦' : `${examLabel} / ${modeLabel}`}
          backgroundImage="/assets/eigo-quest/learning-hub/英検本番形式.png"
          elementLabel="英"
          progressText={result ? `${correctForResult} / ${totalForResult}` : `${answeredCount} / ${questionCount || '-'}`}
          helperImage="/assets/eigo-quest/spirit_assets/happy.png"
          variant="eiken-real"
        />
      </div>
      <header className={`${isEntryScreen ? 'hidden' : ''} mb-4 rounded-[24px] border border-white/80 bg-white/88 px-4 py-3 shadow-[0_14px_34px_rgba(129,164,199,0.14)] backdrop-blur lg:mb-6 lg:flex lg:min-h-[68px] lg:items-center lg:justify-between lg:px-5 max-md:hidden`}>
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

      {(practiceStarted || result) && (
        <div className="sticky top-0 z-30 -mx-4 border-b border-[#dce9f6] bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(129,164,199,0.12)] backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link to="/app" className="shrink-0 text-sm font-bold text-[#52668c]">← ホーム</Link>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-bold text-[#26376d]">{result ? '採点結果' : `英検準2級 ${modeLabel}`}</p>
              <p className="text-xs font-bold text-[#7d8db5]">問 {currentQuestion} / {questionCount || visibleQuestionNumbers.length || '-'}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${currentAnswer ? 'bg-[#eaf7ff] text-[#2f6f9f]' : 'bg-[#f4f7fb] text-[#7d8db5]'}`}>
              {currentStatus}
            </span>
          </div>
        </div>
      )}

      {loading || partLoading ? (
        <div className="mt-5 rounded-[24px] bg-white/80 p-8 text-center font-bold text-[#6f7da8]">問題を読み込み中...</div>
      ) : !partData ? (
        <div className="mt-5 rounded-[24px] bg-white/80 p-8 text-center font-bold text-[#6f7da8]">表示できる問題がありません。</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`gap-4 ${isEntryScreen ? 'eiken-real-trial-entry-layout' : 'lg:grid lg:grid-cols-[220px_minmax(0,1fr)_300px]'}`}
        >
          {!practiceStarted && !result && (
            <section className="eiken-real-trial-entry-card">
              <Link to="/app" className="eiken-real-trial-back">← ホームに戻る</Link>
              <div className="eiken-real-trial-entry-head">
                <span className="eiken-real-trial-crest" aria-hidden="true">英</span>
                <div>
                  <p>Real Exam Trial</p>
                  <h1>英検試練</h1>
                  <strong>年度・パートを選んで挑戦</strong>
                </div>
              </div>

              <div className="eiken-real-trial-segmented" role="group" aria-label="試験モード">
                <button
                  type="button"
                  onClick={() => setMode('listening')}
                  className={mode === 'listening' ? 'is-active' : ''}
                >
                  リスニング
                </button>
                <button
                  type="button"
                  onClick={() => setMode('written')}
                  className={mode === 'written' ? 'is-active' : ''}
                >
                  筆記
                </button>
              </div>

              <div className="eiken-real-trial-select-panel">
                <label>
                  年度・回
                  <select
                    value={selectedExamId}
                    onChange={(event) => setSelectedExamId(event.target.value)}
                  >
                    {exams.map((exam) => (
                      <option key={exam.exam_id} value={exam.exam_id}>
                        {exam.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Part
                  <select
                    value={selectedPartId}
                    onChange={(event) => setSelectedPartId(event.target.value)}
                  >
                    {parts.map((part) => (
                      <option key={part.part_id} value={part.part_id}>
                        {part.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="eiken-real-trial-badges">
                <span className="rounded-full bg-[#eef8ff] px-3 py-2">問題数 {questionCount || '-'}</span>
                <span className="rounded-full bg-[#fff7d6] px-3 py-2">回答数 {answeredCount} / {questionCount || '-'}</span>
                {audioSources.length > 0 && <span className="rounded-full bg-[#eaf9ee] px-3 py-2">音声あり</span>}
              </div>

              <button type="button" onClick={startPractice} className="eiken-real-trial-start" aria-label="試練を開始する">
                試練を開始する
              </button>
            </section>
          )}

          <aside className={`${isEntryScreen ? 'hidden' : ''} eiken-exam-sidebar rounded-[24px] border border-white/80 bg-white/86 p-4 shadow-[0_14px_34px_rgba(129,164,199,0.13)] lg:sticky lg:top-6 lg:self-start max-md:hidden`}>
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
              onClick={() => setIsConfirming(true)}
              disabled={submitting}
              className="mt-3 w-full rounded-[16px] bg-[#26376d] px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#324681] disabled:opacity-45"
            >
              回答確認へ
            </button>
          </aside>

          <main className={`mt-4 min-w-0 lg:mt-0 lg:max-w-[900px] ${isEntryScreen ? 'hidden' : ''}`}>
            {((practiceStarted && !isConfirming) || result) && (
              <div className="sticky top-[57px] z-20 -mx-4 mb-3 flex gap-2 overflow-x-auto border-b border-[#dce9f6] bg-[#f8fcff]/95 px-4 py-3 backdrop-blur md:hidden">
                {visibleQuestionNumbers.map((questionNumber) => (
                  <button
                    key={questionNumber}
                    type="button"
                    onClick={() => goToQuestion(questionNumber)}
                    className={`${getQuestionChipClass(questionNumber)} shrink-0`}
                    aria-current={questionNumber === currentQuestion ? 'true' : undefined}
                  >
                    {questionNumber}
                  </button>
                ))}
              </div>
            )}
            {!result && !isConfirming ? (
              <section className="eiken-real-trial-quiz-panel">
                <div className="eiken-real-trial-quiz-header">
                  <div>
                    <p>{modeLabel}</p>
                    <h2 className="text-xl font-bold text-[#26376d] lg:text-2xl">問{currentQuestion} / {questionCount || visibleQuestionNumbers.length || '-'}</h2>
                  </div>
                  <strong>{currentQuestion} / {questionCount || visibleQuestionNumbers.length || '-'}</strong>
                  <span className={currentAnswer ? 'is-answered' : ''}>
                    {currentStatus}
                  </span>
                </div>

                {audioSources.length > 0 && mode === 'listening' && (
                  <div className="eiken-real-trial-audio-panel">
                    <p className="mb-2 text-xs font-bold text-[#52668c]">音声</p>
                    <div>
                      {audioSources.map((src, index) => (
                        <audio key={`${src}-${index}`} controls preload="metadata" src={src} className="eiken-real-trial-audio-button">
                          <source src={src} type="audio/mpeg" />
                        </audio>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={contentRef} className="eiken-real-content" dangerouslySetInnerHTML={{ __html: normalizedHtml }} />

                <div className="eiken-real-trial-quiz-actions">
                  <button type="button" onClick={goToPreviousQuestion} disabled={currentQuestion === visibleQuestionNumbers[0]} className="eiken-real-trial-secondary-action">
                    前へ
                  </button>
                  {isLastQuestion ? (
                    <button type="button" onClick={() => setIsConfirming(true)} className="eiken-real-trial-gold-action">
                      回答確認へ
                    </button>
                  ) : (
                    <button type="button" onClick={goToNextQuestion} className="eiken-real-trial-gold-action">
                      次へ
                    </button>
                  )}
                </div>
              </section>
            ) : !result && isConfirming ? (
              <section className="eiken-real-trial-result-panel">
                <div className="eiken-real-trial-result-hero">
                  <div>
                    <p className="text-sm font-bold text-[#6f7da8]">Answer Check</p>
                    <h2 className="text-2xl font-bold text-[#26376d]">回答確認</h2>
                    <p className="mt-1 text-sm font-bold text-[#52668c]">
                      {questionCount || visibleQuestionNumbers.length || 0}問中 {answeredCount}問 回答済み
                    </p>
                    <p className={`mt-2 text-sm font-bold ${unansweredCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      未回答 {unansweredCount}問
                    </p>
                  </div>
                  <div className="eiken-real-trial-result-actions">
                    <button type="button" onClick={reviewAnswers} className="eiken-real-trial-result-button">見直す</button>
                    <button type="button" onClick={submitAnswers} disabled={submitting} className="eiken-real-trial-result-button">
                      {submitting ? '提出中...' : '提出する'}
                    </button>
                  </div>
                </div>

                {unansweredCount > 0 ? (
                  <div className="rounded-[20px] bg-rose-50/80 p-4 text-sm font-bold leading-7 text-rose-700">
                    <p>未回答があります</p>
                    <p>このまま提出しますか？</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {unansweredNumbers.map((questionNumber) => (
                        <button
                          key={questionNumber}
                          type="button"
                          onClick={() => goToQuestion(questionNumber)}
                          className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-100"
                        >
                          問{questionNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[20px] bg-emerald-50/80 p-4 text-sm font-bold leading-7 text-emerald-700">
                    すべて回答済みです。提出すると採点結果と解説を確認できます。
                  </div>
                )}
              </section>
            ) : (
              <section className="eiken-real-trial-result-panel">
                <div className="eiken-real-trial-result-hero">
                  <div>
                    <p className="text-sm font-bold text-[#6f7da8]">英検試練 結果</p>
                    <h2 className="text-2xl font-bold text-[#26376d]">
                      {result.answer_key_available ? `正解 ${result.correct_count} / ${result.total_questions}` : '提出しました'}
                    </h2>
                    {result.answer_key_available && <p className="mt-1 text-sm font-bold text-[#52668c]">正答率 {result.score_percent}%</p>}
                    {result.answer_key_available && <span className="eiken-real-trial-rank-badge">Rank {rankBadge}</span>}
                  </div>
                  <div className="eiken-real-trial-result-actions">
                    <button type="button" onClick={reviewMistakes} className="eiken-real-trial-result-button">まちがいを復習する</button>
                    <button type="button" onClick={resetAnswers} className="eiken-real-trial-result-button">もう一度挑戦</button>
                    <button type="button" onClick={showAllExplanations} className="eiken-real-trial-result-button">解説を見る</button>
                  </div>
                </div>

                {result.answer_key_available ? (
                  <div className="grid gap-3">
                    {explanations.map((item) => {
                      const studentAnswer = getQuestionAnswer(answers, item.question_number);
                      const isCorrect = studentAnswer && studentAnswer === item.correct_answer;
                      const isExpanded = expandedExplanations[item.question_number];
                      const preview = questionPreviews[item.question_number];
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
                          <EikenResultQuestionPreview
                            preview={preview}
                            studentAnswer={studentAnswer}
                            correctAnswer={item.correct_answer}
                            expanded={isExpanded}
                          />
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

          {practiceStarted && !result && !isConfirming && (
            <div className="eiken-real-trial-mobile-actions md:hidden">
              <div className="mx-auto flex max-w-md items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goToPreviousQuestion}
                  disabled={currentQuestion === visibleQuestionNumbers[0]}
                  className="eiken-real-trial-secondary-action"
                >
                  前へ
                </button>
                {isLastQuestion ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirming(true)}
                    className="eiken-real-trial-gold-action"
                  >
                    回答確認へ
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goToNextQuestion}
                    className="eiken-real-trial-gold-action"
                  >
                    次へ
                  </button>
                )}
              </div>
            </div>
          )}

          <aside className={`${isEntryScreen ? 'hidden' : ''} hidden rounded-[24px] border border-white/80 bg-white/86 p-4 shadow-[0_14px_34px_rgba(129,164,199,0.13)] lg:sticky lg:top-6 lg:block lg:self-start`}>
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
                <button type="button" onClick={showAllExplanations} className="mt-4 w-full rounded-[16px] bg-[#26376d] px-4 py-3 text-sm font-bold text-white shadow-sm">
                  解説を見る
                </button>
              </div>
            )}
          </aside>
        </motion.div>
      )}
      <EQBottomNav className="eiken-real-trial-bottom-nav" />
    </div>
  );
}
