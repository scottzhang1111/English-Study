import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { EQBottomNav } from '../components/eigo';
import { API_BASE_URL, getEikenRealExamPart, getEikenRealExams, submitEikenRealExamAttempt } from '../api';
import { useChildren } from '../ChildrenContext';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import { getEikenAssetSrc, normalizeEikenMediaHtml } from '../utils/eikenAssets';

const CHILD_STORAGE_KEY = 'selected_child_id';
const EIKEN_AUDIO_LOAD_ERROR_MESSAGE = '音声ファイルを読み込めませんでした。素材ファイルを確認してください。';
const EIKEN_IMAGE_LOAD_ERROR_MESSAGE = '画像ファイルを読み込めませんでした。素材ファイルを確認してください。';

function getDefaultPart(exam, mode) {
  const parts = mode === 'written' ? exam?.written_parts : exam?.listening_parts;
  return parts?.[0]?.part_id || '';
}

function getPartList(exam, mode) {
  return mode === 'written' ? exam?.written_parts || [] : exam?.listening_parts || [];
}

function getEikenLevelLabel(level) {
  const value = String(level || '').toLowerCase().replace(/[-\s]/g, '_');
  if (value === 'eiken3' || value === 'eiken_3' || value.includes('3級')) return '3級';
  return '準2級';
}

function resolveApiAssetUrl(url) {
  if (!url) return '';
  const value = String(url).trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const base = String(API_BASE_URL || '').replace(/\/$/, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
}

function resolveApiMediaHtml(html = '') {
  return String(html).replace(/\b(src|href)=(["'])([^"']+)\2/gi, (match, attr, quote, value) => {
    const normalizedValue = String(value || '').trim();
    if (!/^\/?api\//i.test(normalizedValue)) return match;
    return `${attr}=${quote}${resolveApiAssetUrl(normalizedValue)}${quote}`;
  });
}

function getEikenImageSrc(imagePath, childId, targetLevel) {
  return resolveApiAssetUrl(getEikenAssetSrc(imagePath, childId, targetLevel));
}

function getEikenAudioSrc(audioPath, childId, targetLevel) {
  return resolveApiAssetUrl(getEikenAssetSrc(audioPath, childId, targetLevel));
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

function getResultStatus(studentAnswer, correctAnswer) {
  if (!studentAnswer) return 'unanswered';
  return studentAnswer === correctAnswer ? 'correct' : 'wrong';
}

function getResultStatusLabel(status) {
  if (status === 'correct') return '正解';
  if (status === 'unanswered') return '未回答';
  return '不正解';
}

function formatResultAnswer(answer) {
  return answer || '未回答';
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getFallbackExplanation(status, studentAnswer, correctAnswer) {
  if (status === 'unanswered') {
    return `この問題は未回答でした。正解は ${correctAnswer || '-'} です。選択肢の意味を確認して、会話の最後に自然につながる返事を選びましょう。`;
  }
  return `最後の会話に合う返事を選ぶ問題です。正解は ${correctAnswer || '-'} です。あなたの答えは ${studentAnswer || '未回答'} でした。選択肢の意味を比べて、会話の流れに最も自然な返事を選びましょう。`;
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
              {EIKEN_IMAGE_LOAD_ERROR_MESSAGE}
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

function EikenResultExplanationCard({
  questionNumber,
  studentAnswer,
  correctAnswer,
  preview,
  explanation,
  childId,
  targetLevel,
  expanded,
  onToggle,
}) {
  const status = getResultStatus(studentAnswer, correctAnswer);
  const statusLabel = getResultStatusLabel(status);
  const hasChoices = preview?.choices?.length > 0;
  const explanationHtml = explanation?.html ? resolveApiMediaHtml(normalizeEikenMediaHtml(explanation.html, childId, targetLevel)) : '';

  return (
    <article className={`eiken-real-result-row is-${status}`}>
      <button type="button" className="eiken-real-result-row-head" onClick={onToggle}>
        <span className="eiken-real-result-question">問{questionNumber}</span>
        <span className={`eiken-real-result-status is-${status}`}>{statusLabel}</span>
        <span className="eiken-real-result-answer is-student">あなた：{formatResultAnswer(studentAnswer)}</span>
        <span className="eiken-real-result-answer is-correct">正解：{formatResultAnswer(correctAnswer)}</span>
        <span className={`eiken-real-result-arrow ${expanded ? 'is-open' : ''}`} aria-hidden="true">⌄</span>
      </button>

      {expanded && (
        <div className="eiken-real-result-detail">
          <div className="eiken-real-result-detail-head">
            <span>問{questionNumber}</span>
            <strong className={`is-${status}`}>{statusLabel}</strong>
            <em>あなた：{formatResultAnswer(studentAnswer)}</em>
            <em>正解：{formatResultAnswer(correctAnswer)}</em>
          </div>

          <section>
            <h3>問題</h3>
            <p>{preview?.summary || '問題文を表示できませんでした。'}</p>
          </section>

          {hasChoices && (
            <section>
              <h3>選択肢</h3>
              <div className="eiken-real-result-choices">
                {preview.choices.map((choice) => {
                  const isCorrectChoice = correctAnswer && choice.includes(correctAnswer);
                  const isStudentChoice = studentAnswer && choice.includes(studentAnswer);
                  return (
                    <div
                      key={choice}
                      className={`eiken-real-result-choice ${isCorrectChoice ? 'is-correct' : ''} ${isStudentChoice && !isCorrectChoice ? 'is-student-wrong' : ''}`}
                    >
                      <span>{choice}</span>
                      {isStudentChoice && <b>あなたの答え</b>}
                      {isCorrectChoice && <b>正解</b>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h3>答え</h3>
            <p className="eiken-real-result-correct-answer">{formatResultAnswer(correctAnswer)}</p>
          </section>

          <section>
            <h3>解説</h3>
            {explanationHtml ? (
              <div
                className="eiken-real-result-explanation-html"
                dangerouslySetInnerHTML={{ __html: explanationHtml }}
              />
            ) : (
              <p>{getFallbackExplanation(status, studentAnswer, correctAnswer)}</p>
            )}
          </section>
        </div>
      )}
    </article>
  );
}

export default function EikenRealExamPage() {
  const contentRef = useRef(null);
  const audioRefs = useRef([]);
  const dropdownRef = useRef(null);
  const { children, selectedChildId } = useChildren();
  const activeChildId = selectedChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const selectedChild = useMemo(
    () => (children || []).find((child) => String(child.id) === String(activeChildId)) || null,
    [children, activeChildId],
  );
  const activeTargetLevel = selectedChild?.targetLevel || selectedChild?.target_level || '';
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
  const [openDropdown, setOpenDropdown] = useState('');
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [audioLoadFailed, setAudioLoadFailed] = useState(false);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.exam_id === selectedExamId) || exams[0] || null,
    [exams, selectedExamId],
  );
  const parts = useMemo(() => getPartList(selectedExam, mode), [selectedExam, mode]);
  const selectedPart = useMemo(
    () => parts.find((part) => part.part_id === selectedPartId) || parts[0] || null,
    [parts, selectedPartId],
  );
  const questionCount = partData?.question_count || 0;
  const visibleQuestionNumbers = questionNumbers.length > 0
    ? questionNumbers
    : partData?.question_numbers?.length
      ? partData.question_numbers
      : buildQuestionNumbers(questionCount);
  const normalizedHtml = useMemo(
    () => resolveApiMediaHtml(normalizeEikenMediaHtml(partData?.html || '', activeChildId, activeTargetLevel)),
    [partData?.html, activeChildId, activeTargetLevel],
  );
  const questionPreviews = useMemo(() => extractEikenQuestionPreviews(normalizedHtml, mode), [normalizedHtml, mode]);
  const audioSources = useMemo(
    () => (partData?.audio_paths || []).map((audioPath) => getEikenAudioSrc(audioPath, activeChildId, activeTargetLevel)).filter(Boolean),
    [partData?.audio_paths, activeChildId, activeTargetLevel],
  );
  const primaryAudioSource = audioSources[0] || '';
  const explanations = result?.explanations || [];

  useEffect(() => {
    let active = true;
    getEikenRealExams({ childId: activeChildId, targetLevel: activeTargetLevel })
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
  }, [activeChildId, activeTargetLevel]);

  useEffect(() => {
    if (!selectedExam) return;
    setSelectedPartId(getDefaultPart(selectedExam, mode));
  }, [selectedExam, mode]);

  useEffect(() => {
    if (!openDropdown) return undefined;
    const handlePointerDown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openDropdown]);

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
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioIsPlaying(false);
    setAudioLoadFailed(false);
    setExpandedExplanations({});
    setStartedAt(new Date().toISOString());
    getEikenRealExamPart(selectedPartId, { childId: activeChildId, targetLevel: activeTargetLevel })
      .then((payload) => {
        if (!active) return;
        setPartData(payload);
      })
      .catch((err) => setError(err.message))
      .finally(() => active && setPartLoading(false));
    return () => {
      active = false;
    };
  }, [selectedPartId, activeChildId, activeTargetLevel]);

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
    if (!element || mode !== 'listening') return undefined;
    const selectOptionFromRow = (event) => {
      const optionCell = event.target.closest('.hpb-cnt-tb1 td');
      if (!optionCell || !element.contains(optionCell)) return;
      const radio = optionCell.querySelector('input[type="radio"]') || optionCell.closest('tr')?.querySelector('input[type="radio"]');
      if (!radio || event.target === radio) return;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    };
    element.addEventListener('click', selectOptionFromRow);
    return () => element.removeEventListener('click', selectOptionFromRow);
  }, [normalizedHtml, mode]);

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
        fallback.textContent = EIKEN_IMAGE_LOAD_ERROR_MESSAGE;
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

  const playAudioSource = (index) => {
    const audio = audioRefs.current[index];
    if (!audio) return;
    audio.play();
  };

  const togglePrimaryAudio = () => {
    const audio = audioRefs.current[0];
    if (!audio) return;
    if (audio.paused) {
      playAudioSource(0);
    } else {
      audio.pause();
    }
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
    const childId = activeChildId;
    if (!childId) {
      setError('子どもを選んでから提出してください。');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = await submitEikenRealExamAttempt({
        childId,
        targetLevel: activeTargetLevel,
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
  const levelLabel = getEikenLevelLabel(partData?.level || activeTargetLevel);
  const audioProgress = audioDuration > 0 ? Math.min(100, (audioCurrentTime / audioDuration) * 100) : 0;
  const audioRemaining = audioDuration > 0 ? Math.max(0, audioDuration - audioCurrentTime) : 0;
  const isEntryScreen = !practiceStarted && !result;
  const isListeningPractice = practiceStarted && !result && !isConfirming && mode === 'listening';
  const examRoundLabel = selectedExam ? `${selectedExam.year}年第${selectedExam.round}回` : '2025年第3回';
  const totalPracticeQuestions = questionCount || visibleQuestionNumbers.length || 0;
  const totalForResult = result?.total_questions || questionCount || visibleQuestionNumbers.length || 0;
  const correctForResult = result?.answer_key_available ? result.correct_count || 0 : 0;
  const scorePercent = result?.answer_key_available && totalForResult
    ? Math.round((correctForResult / totalForResult) * 100)
    : 0;
  const rankBadge = scorePercent >= 90 ? 'S' : scorePercent >= 75 ? 'A' : scorePercent >= 55 ? 'B' : 'C';
  const resultRows = useMemo(() => {
    const explanationMap = Object.fromEntries((explanations || []).map((item) => [Number(item.question_number), item]));
    return visibleQuestionNumbers.map((questionNumber) => {
      const studentAnswer = getQuestionAnswer(answers, questionNumber);
      const correctAnswer = getCorrectAnswerForQuestion(result?.correct_answers, questionNumber);
      return {
        questionNumber,
        studentAnswer,
        correctAnswer,
        status: getResultStatus(studentAnswer, correctAnswer),
        explanation: explanationMap[Number(questionNumber)] || null,
        preview: questionPreviews[questionNumber],
      };
    });
  }, [answers, explanations, questionPreviews, result?.correct_answers, visibleQuestionNumbers]);
  const incorrectForResult = resultRows.filter((item) => item.status === 'wrong').length;
  const unansweredForResult = resultRows.filter((item) => item.status === 'unanswered').length;
  const reviewMistakes = () => {
    const wrongNumbers = resultRows.filter((item) => item.status !== 'correct').map((item) => item.questionNumber);
    const entries = wrongNumbers.length > 0
      ? wrongNumbers.map((questionNumber) => [questionNumber, true])
      : resultRows.map((item) => [item.questionNumber, true]);
    setExpandedExplanations(Object.fromEntries(entries));
  };
  const reviewAnswers = () => {
    const targetQuestion = unansweredNumbers[0] || visibleQuestionNumbers[0] || currentQuestion;
    goToQuestion(targetQuestion);
  };
  const showAllExplanations = () => {
    setExpandedExplanations(Object.fromEntries(resultRows.map((item) => [item.questionNumber, true])));
  };

  return (
    <div className={`eiken-exam-page eiken-real-trial-page mx-auto max-w-[1440px] px-3 pb-28 pt-2 text-[#26376d] lg:px-5 lg:py-4 ${practiceStarted && !result ? 'max-md:pb-36' : ''} ${isListeningPractice ? 'is-listening-practice' : ''}`}>
      <div className={`eiken-real-trial-compact-wrap md:hidden ${isListeningPractice ? 'hidden' : ''}`}>
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
      {false && (<header className={`${isEntryScreen ? 'hidden' : ''} mb-4 rounded-[24px] border border-white/80 bg-white/88 px-4 py-3 shadow-[0_14px_34px_rgba(129,164,199,0.14)] backdrop-blur lg:mb-6 lg:flex lg:min-h-[68px] lg:items-center lg:justify-between lg:px-5 max-md:hidden`}>
        <Link to="/app" className="text-sm font-bold text-[#52668c] transition hover:text-[#26376d]">
          ← ホームに戻る
        </Link>
        <div className="mt-2 lg:mt-0 lg:text-center">
          <p className="text-xs font-bold text-[#7d8db5]">英検{levelLabel}</p>
          <h1 className="text-xl font-bold leading-tight text-[#26376d] lg:text-2xl">{examLabel}</h1>
          <p className="text-sm font-bold text-[#4e6d9e]">{modeLabel}</p>
        </div>
        <div className="mt-2 text-sm font-bold text-[#52668c] lg:mt-0 lg:text-right">
          <p>{selectedChild?.name || '学習中'}</p>
          <p className="text-xs text-[#7d8db5]">{result ? '採点済み' : currentStatus}</p>
        </div>
      </header>)}

      {error && <div className="mb-4 rounded-[18px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

      {false && (
        <div className="sticky top-0 z-30 -mx-4 border-b border-[#dce9f6] bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(129,164,199,0.12)] backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link to="/app" className="shrink-0 text-sm font-bold text-[#52668c]">← ホーム</Link>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-bold text-[#26376d]">{result ? '採点結果' : `英検${levelLabel} ${modeLabel}`}</p>
              <p className="text-xs font-bold text-[#7d8db5]">問 {currentQuestion} / {questionCount || visibleQuestionNumbers.length || '-'}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${currentAnswer ? 'bg-[#eaf7ff] text-[#2f6f9f]' : 'bg-[#f4f7fb] text-[#7d8db5]'}`}>
              {currentStatus}
            </span>
          </div>
        </div>
      )}

      {loading || partLoading ? (
        <div className="eiken-real-trial-status-card" role="status" aria-live="polite">
          <span className="eiken-real-trial-status-orb" aria-hidden="true" />
          <p>Real Exam Trial</p>
          <strong>問題を読み込み中...</strong>
          <div className="eiken-real-trial-status-tabs" aria-hidden="true">
            <span className={mode === 'listening' ? 'is-active' : ''}>🎧 リスニング</span>
            <span className={mode === 'written' ? 'is-active' : ''}>✎ 筆記</span>
          </div>
        </div>
      ) : !partData ? (
        <div className="eiken-real-trial-status-card" role="status">
          <span className="eiken-real-trial-status-orb" aria-hidden="true" />
          <p>Real Exam Trial</p>
          <strong>表示できる問題がありません。</strong>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`gap-4 ${isEntryScreen ? 'eiken-real-trial-entry-layout' : 'eiken-real-trial-practice-layout'}`}
        >
          {!practiceStarted && !result && (
            <section className="eiken-real-trial-entry-card">
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
                  <span aria-hidden="true">🎧</span>
                  リスニング
                </button>
                <button
                  type="button"
                  onClick={() => setMode('written')}
                  className={mode === 'written' ? 'is-active' : ''}
                >
                  <span aria-hidden="true">✎</span>
                  筆記
                </button>
              </div>

              <div className="eiken-real-trial-select-panel" ref={dropdownRef}>
                <label>
                  年度・回
                  <div className={`eiken-real-custom-select ${openDropdown === 'exam' ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="eiken-real-custom-select-trigger"
                      onClick={() => setOpenDropdown((current) => (current === 'exam' ? '' : 'exam'))}
                      aria-haspopup="listbox"
                      aria-expanded={openDropdown === 'exam'}
                    >
                      <span>{selectedExam?.label || '年度・回を選択'}</span>
                      <i aria-hidden="true">{openDropdown === 'exam' ? '⌃' : '⌄'}</i>
                    </button>
                    {openDropdown === 'exam' && (
                      <div className="eiken-real-custom-select-menu is-exam" role="listbox">
                        {exams.map((exam) => {
                          const isSelected = exam.exam_id === selectedExamId;
                          return (
                            <button
                              key={exam.exam_id}
                              type="button"
                              className={isSelected ? 'is-selected' : ''}
                              onClick={() => {
                                setSelectedExamId(exam.exam_id);
                                setOpenDropdown('');
                              }}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <span aria-hidden="true">{isSelected ? '✓' : ''}</span>
                              <strong>{exam.label}</strong>
                            </button>
                          );
                        })}
                        {exams.length > 8 && (
                          <div className="eiken-real-custom-select-more">
                            <span>もっと見る</span>
                            <i aria-hidden="true">⌄</i>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
                <label>
                  Part
                  <div className={`eiken-real-custom-select ${openDropdown === 'part' ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="eiken-real-custom-select-trigger"
                      onClick={() => setOpenDropdown((current) => (current === 'part' ? '' : 'part'))}
                      aria-haspopup="listbox"
                      aria-expanded={openDropdown === 'part'}
                    >
                      <span>{selectedPart?.label || 'Partを選択'}</span>
                      <i aria-hidden="true">{openDropdown === 'part' ? '⌃' : '⌄'}</i>
                    </button>
                    {openDropdown === 'part' && (
                      <div className="eiken-real-custom-select-menu is-part" role="listbox">
                        {parts.map((part) => {
                          const isSelected = part.part_id === selectedPartId;
                          return (
                            <button
                              key={part.part_id}
                              type="button"
                              className={isSelected ? 'is-selected' : ''}
                              onClick={() => {
                                setSelectedPartId(part.part_id);
                                setOpenDropdown('');
                              }}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <span aria-hidden="true">{isSelected ? '✓' : ''}</span>
                              <strong>{part.label}</strong>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="eiken-real-trial-badges">
                <span className="rounded-full bg-[#eef8ff] px-3 py-2"><i aria-hidden="true">?</i> 問題数 {questionCount || '-'}</span>
                <span className="rounded-full bg-[#fff7d6] px-3 py-2"><i aria-hidden="true">☑</i> 回答数 {answeredCount} / {questionCount || '-'}</span>
                {audioSources.length > 0 && <span className="rounded-full bg-[#eaf9ee] px-3 py-2"><i aria-hidden="true">🔊</i> 音声あり</span>}
              </div>

              <button type="button" onClick={startPractice} className="eiken-real-trial-start" aria-label="試練を開始する">
                <span className="eiken-real-trial-start-compass" aria-hidden="true">🧭</span>
                <span>試練を開始する</span>
                <span className="eiken-real-trial-start-arrow" aria-hidden="true">›</span>
              </button>
            </section>
          )}

          {false && (<aside className={`${isEntryScreen ? 'hidden' : ''} eiken-exam-sidebar rounded-[24px] border border-white/80 bg-white/86 p-4 shadow-[0_14px_34px_rgba(129,164,199,0.13)] lg:sticky lg:top-6 lg:self-start max-md:hidden`}>
            <div>
              <p className="text-xs font-bold text-[#7d8db5]">英検{levelLabel}</p>
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
          </aside>)}

          <main className={`mt-4 min-w-0 lg:mt-0 lg:max-w-[900px] ${isEntryScreen ? 'hidden' : ''}`}>
            {false && (
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
                {isListeningPractice && (
                  <section className="eiken-real-listening-exam-card" aria-label="試験情報">
                    <div className="eiken-real-listening-emblem" aria-hidden="true">E</div>
                    <div className="eiken-real-listening-exam-copy">
                      <h1>英語検定({levelLabel}) リスニング</h1>
                      <p>{examRoundLabel}</p>
                    </div>
                    <strong>{currentQuestion} / {totalPracticeQuestions || '-'}</strong>
                  </section>
                )}

                <div className="eiken-real-trial-quiz-header">
                  <div>
                    <p>{modeLabel}</p>
                    <h2 className="text-xl font-bold text-[#26376d] lg:text-2xl">問{currentQuestion} / {questionCount || visibleQuestionNumbers.length || '-'}</h2>
                  </div>
                  <span className={currentAnswer ? 'is-answered' : ''}>
                    {currentStatus}
                  </span>
                </div>

                {isListeningPractice && primaryAudioSource && (
                  <section className="eiken-real-trial-audio-panel" aria-label="音声">
                    <div className="eiken-real-trial-audio-head">
                      <span aria-hidden="true">♪</span>
                      <div>
                        <h2>音声</h2>
                        <p>問1から問10は、対話を聞き、その最後の文に対する応答として最も適切なものを選ぶ形式です。</p>
                      </div>
                    </div>
                    <div className="eiken-real-trial-audio-player">
                      <button
                        type="button"
                        className={`eiken-real-trial-audio-play ${audioIsPlaying ? 'is-playing' : ''}`}
                        onClick={togglePrimaryAudio}
                        aria-label={audioIsPlaying ? '音声を一時停止' : '音声を再生'}
                      >
                        <span aria-hidden="true" />
                      </button>
                      <span>{formatAudioTime(audioCurrentTime)}</span>
                      <div className="eiken-real-trial-audio-track" aria-hidden="true">
                        <i style={{ width: `${audioProgress}%` }} />
                      </div>
                      <span>-{formatAudioTime(audioRemaining)}</span>
                      <span className="eiken-real-trial-audio-volume" aria-hidden="true">⌕</span>
                    </div>
                    <audio
                      ref={(element) => {
                        audioRefs.current[0] = element;
                      }}
                      preload="metadata"
                      src={primaryAudioSource}
                      className="eiken-real-trial-audio-button"
                      onLoadedMetadata={(event) => {
                        setAudioLoadFailed(false);
                        setAudioDuration(event.currentTarget.duration || 0);
                        setAudioCurrentTime(event.currentTarget.currentTime || 0);
                      }}
                      onTimeUpdate={(event) => {
                        setAudioCurrentTime(event.currentTarget.currentTime || 0);
                      }}
                      onPlay={() => setAudioIsPlaying(true)}
                      onPause={() => setAudioIsPlaying(false)}
                      onEnded={(event) => {
                        setAudioIsPlaying(false);
                        setAudioCurrentTime(event.currentTarget.duration || 0);
                      }}
                      onError={() => {
                        setAudioIsPlaying(false);
                        setAudioLoadFailed(true);
                      }}
                    >
                      <source src={primaryAudioSource} type="audio/mpeg" />
                    </audio>
                    {audioLoadFailed && (
                      <p className="mt-3 rounded-[14px] bg-rose-50/90 px-3 py-2 text-center text-sm font-bold text-rose-700">
                        {EIKEN_AUDIO_LOAD_ERROR_MESSAGE}
                      </p>
                    )}
                  </section>
                )}

                {false && audioSources.length > 0 && mode === 'listening' && (
                  <div className="eiken-real-trial-audio-panel">
                    <p className="mb-2 text-xs font-bold text-[#52668c]">音声</p>
                    <div>
                      {audioSources.map((src, index) => (
                        <div key={`${src}-${index}`} className="eiken-real-trial-audio-control">
                          <button
                            type="button"
                            className="eiken-real-trial-audio-play"
                            onClick={() => playAudioSource(index)}
                            aria-label="音声を再生"
                          >
                            <span aria-hidden="true" />
                          </button>
                          <audio
                            ref={(element) => {
                              audioRefs.current[index] = element;
                            }}
                            preload="metadata"
                            src={src}
                            className="eiken-real-trial-audio-button"
                          >
                            <source src={src} type="audio/mpeg" />
                          </audio>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <section className="eiken-real-listening-question-card">
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
              </section>
            ) : !result && isConfirming ? (
              <section className="eiken-real-trial-confirm-panel">
                <div className="eiken-real-trial-confirm-ornament" aria-hidden="true" />
                <div className="eiken-real-trial-confirm-head">
                  <p>TRIAL RESULT</p>
                  <h2>回答確認</h2>
                </div>

                <div className="eiken-real-trial-confirm-stats">
                  <span>
                    <i aria-hidden="true">□</i>
                    {questionCount || visibleQuestionNumbers.length || 0}問中 {answeredCount}問 回答済み
                  </span>
                  <span className={unansweredCount > 0 ? 'is-warning' : ''}>
                    <i aria-hidden="true">?</i>
                    未回答 {unansweredCount}問
                  </span>
                </div>

                <div className="eiken-real-trial-confirm-actions">
                  <button
                    type="button"
                    onClick={submitAnswers}
                    disabled={submitting}
                    className="eiken-real-trial-confirm-primary"
                  >
                    {submitting ? '提出中...' : '提出する'}
                  </button>
                  <button
                    type="button"
                    onClick={reviewAnswers}
                    className="eiken-real-trial-confirm-secondary"
                  >
                    見直す
                  </button>
                </div>

                {unansweredCount > 0 && (
                  <div className="eiken-real-trial-unanswered-warning">
                    <span className="eiken-real-trial-warning-icon" aria-hidden="true">!</span>
                    <div>
                      <h3>未回答があります</h3>
                      <p>このまま提出しますか？</p>
                    </div>
                    <div className="eiken-real-trial-warning-pills">
                      {unansweredNumbers.map((questionNumber) => (
                        <button
                          key={questionNumber}
                          type="button"
                          onClick={() => goToQuestion(questionNumber)}
                        >
                          問{questionNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {false && (<>
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
                </>)}
              </section>
            ) : (
              <section className="eiken-real-trial-result-panel">
                <div className="eiken-real-result-summary">
                  <div className="eiken-real-result-score-grid">
                    <div>
                      <span>正解</span>
                      <strong>{correctForResult} / {totalForResult}</strong>
                    </div>
                    <div>
                      <span>正答率</span>
                      <strong>{scorePercent}%</strong>
                    </div>
                    <div>
                      <span>Rank</span>
                      <strong className="eiken-real-result-rank">{rankBadge}</strong>
                    </div>
                  </div>

                  <div className="eiken-real-result-counts">
                    <span className="is-correct">正解 {correctForResult}問</span>
                    <span className="is-wrong">不正解 {incorrectForResult}問</span>
                    <span className="is-unanswered">未回答 {unansweredForResult}問</span>
                  </div>

                  <div className="eiken-real-result-actions">
                    <button type="button" onClick={reviewMistakes} className="is-review">まちがいを復習する</button>
                    <button type="button" onClick={resetAnswers} className="is-retry">もう一度挑戦</button>
                    <button type="button" onClick={showAllExplanations} className="is-explain">解説を見る</button>
                  </div>
                </div>

                <div className="eiken-real-result-list-head">解説一覧</div>
                <div className="eiken-real-result-list">
                  {resultRows.map((item) => (
                    <EikenResultExplanationCard
                      key={item.questionNumber}
                      questionNumber={item.questionNumber}
                      studentAnswer={item.studentAnswer}
                      correctAnswer={item.correctAnswer}
                      preview={item.preview}
                      explanation={item.explanation}
                      childId={activeChildId}
                      targetLevel={activeTargetLevel}
                      expanded={Boolean(expandedExplanations[item.questionNumber])}
                      onToggle={() => setExpandedExplanations((prev) => ({
                        ...prev,
                        [item.questionNumber]: !prev[item.questionNumber],
                      }))}
                    />
                  ))}
                </div>
                {false && (<>
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
                              dangerouslySetInnerHTML={{ __html: resolveApiMediaHtml(normalizeEikenMediaHtml(item.html || '', activeChildId, activeTargetLevel)) }}
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
                </>)}
              </section>
            )}
          </main>

          {false && (
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

          {false && (<aside className={`${isEntryScreen ? 'hidden' : ''} hidden rounded-[24px] border border-white/80 bg-white/86 p-4 shadow-[0_14px_34px_rgba(129,164,199,0.13)] lg:sticky lg:top-6 lg:block lg:self-start`}>
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
          </aside>)}
        </motion.div>
      )}
      <EQBottomNav className="eiken-real-trial-bottom-nav" />
    </div>
  );
}
