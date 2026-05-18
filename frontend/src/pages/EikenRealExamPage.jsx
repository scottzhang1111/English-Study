import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getEikenRealExamPart, getEikenRealExams } from '../api';

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

function normalizeEikenImageHtml(html = '') {
  return html.replace(/\b(src)=(["'])([^"']+\.(?:png|gif|jpg|jpeg))(?:[?#][^"']*)?\2/gi, (match, attr, quote, value) => {
    const imageSrc = getEikenImageSrc(value);
    return imageSrc ? `${attr}=${quote}${imageSrc}${quote}` : match;
  });
}

export default function EikenRealExamPage() {
  const contentRef = useRef(null);
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [mode, setMode] = useState('listening');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partData, setPartData] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [partLoading, setPartLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedExam = useMemo(
    () => exams.find((exam) => exam.exam_id === selectedExamId) || exams[0] || null,
    [exams, selectedExamId],
  );
  const parts = useMemo(() => getPartList(selectedExam, mode), [selectedExam, mode]);
  const questionCount = partData?.question_count || 0;
  const normalizedHtml = useMemo(() => normalizeEikenImageHtml(partData?.html || ''), [partData?.html]);

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
      setAnsweredCount(Math.min(checkedNames.size, names.size));
    };
    updateAnsweredCount();
    element.addEventListener('change', updateAnsweredCount);
    return () => element.removeEventListener('change', updateAnsweredCount);
  }, [partData?.part_id]);

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
    if (!element) return;
    element.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.checked = false;
    });
    setAnsweredCount(0);
  };

  return (
    <div className="eiken-exam-page mx-auto max-w-[720px] px-0 pb-28 pt-0">
      {error && <div className="mx-4 mt-4 rounded-[18px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

      {loading || partLoading ? (
        <div className="mt-5 rounded-[24px] bg-white/76 p-8 text-center font-bold text-[#6f7da8]">過去問を読み込み中...</div>
      ) : !partData ? (
        <div className="mt-5 rounded-[24px] bg-white/76 p-8 text-center font-bold text-[#6f7da8]">表示できる過去問がありません。</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid min-h-screen gap-4 lg:grid-cols-[188px_minmax(0,1fr)]"
        >
          <aside className="eiken-exam-sidebar px-4 py-5">
            <p className="text-[11px] font-black text-[#7d8db5]">{partData.mode_label || 'リスニング'}</p>
            <h1 className="mt-2 text-[18px] font-black leading-tight text-[#26376d]">{partData.title}</h1>

            <div className="mt-5 grid gap-2 text-[11px] font-black text-[#5d70a1]">
              <span className="rounded-full bg-[#eef8ff] px-3 py-2">問題 {questionCount || '-'} 問</span>
              <span className="rounded-full bg-[#fff7d6] px-3 py-2">回答 {answeredCount} / {questionCount || '-'}</span>
              {partData.audio_paths?.length > 0 && <span className="rounded-full bg-[#eaf9ee] px-3 py-2">音声あり</span>}
            </div>

            <div className="mt-8 space-y-3">
              <label className="block text-[11px] font-black text-[#52668c]">
                年度・回
                <select
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                  className="mt-1 w-full rounded-[14px] border border-[#d5e5f6] bg-white px-3 py-2 text-xs font-bold text-[#26376d]"
                >
                  {exams.map((exam) => (
                    <option key={exam.exam_id} value={exam.exam_id}>
                      {exam.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-black text-[#52668c]">
                パート
                <select
                  value={selectedPartId}
                  onChange={(event) => setSelectedPartId(event.target.value)}
                  className="mt-1 w-full rounded-[14px] border border-[#d5e5f6] bg-white px-3 py-2 text-xs font-bold text-[#26376d]"
                >
                  {parts.map((part) => (
                    <option key={part.part_id} value={part.part_id}>
                      {part.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('listening')}
                  className={`rounded-[14px] px-2 py-2 text-[11px] font-black ${mode === 'listening' ? 'bg-[#26376d] text-white' : 'bg-white text-[#52668c]'}`}
                >
                  音声
                </button>
                <button
                  type="button"
                  onClick={() => setMode('written')}
                  className={`rounded-[14px] px-2 py-2 text-[11px] font-black ${mode === 'written' ? 'bg-[#26376d] text-white' : 'bg-white text-[#52668c]'}`}
                >
                  筆記
                </button>
              </div>
            </div>

            <button type="button" onClick={resetAnswers} className="mt-8 w-full rounded-[14px] bg-white px-3 py-2 text-xs font-black text-[#52668c] shadow-sm">
              選択をリセット
            </button>

            <p className="mt-6 rounded-[18px] bg-white/78 p-3 text-[10px] font-bold leading-5 text-[#6f7da8]">
              採点ボタンはこの画面では使いません。答えを選んでから、先生や解答表と一緒に確認してください。
            </p>
          </aside>

          <main className="min-w-0 px-3 py-3 sm:px-4">
            <div ref={contentRef} className="eiken-real-content" dangerouslySetInnerHTML={{ __html: normalizedHtml }} />
          </main>
        </motion.div>
      )}
    </div>
  );
}
