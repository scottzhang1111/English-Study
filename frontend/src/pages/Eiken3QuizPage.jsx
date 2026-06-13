import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import WebLearningLayout from '../components/WebLearningLayout';
import { EQBottomNav } from '../components/eigo';
import { getEiken3Quiz, submitEiken3Quiz } from '../api';

const SECTION_LABELS = {
  sentence_fill: '短文の語句空所補充',
  dialogue_completion: '会話文の文選択',
  reading: '長文の内容一致選択',
};

function getQuestionSection(question) {
  const no = Number(question?.question_no || 0);
  if (no >= 21) return '長文の内容一致選択';
  if (no >= 16) return '会話文の文選択';
  return question?.section || SECTION_LABELS[question?.question_type] || '短文の語句空所補充';
}

function PassageCard({ passage }) {
  if (!passage) return null;
  return (
    <section className="rounded-[24px] border border-[#d8e8f8] bg-[#f8fcff] p-4 text-[#354172]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black uppercase text-[#52668c]">
          {passage.passage_type || passage.genre || 'passage'}
        </span>
        <strong className="text-lg font-black">{passage.title}</strong>
      </div>
      {passage.title_ja && <p className="mt-1 text-sm font-bold text-[#7d8db5]">{passage.title_ja}</p>}
      <p className="mt-4 whitespace-pre-line rounded-[18px] bg-white/86 p-4 text-sm font-bold leading-7 text-[#405174]">
        {passage.passage_text}
      </p>
      {passage.key_points_ja && (
        <p className="mt-3 rounded-[16px] bg-[#fff7d6] p-3 text-xs font-bold leading-6 text-[#75622c]">
          {passage.key_points_ja}
        </p>
      )}
    </section>
  );
}

function WritingPrompts({ prompts = [], showSamples = false }) {
  if (!prompts.length) return null;
  return (
    <section className="mt-5 rounded-[26px] border border-white/80 bg-white/86 p-5 shadow-[0_16px_36px_rgba(129,164,199,0.13)]">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8fa0c2]">Writing</p>
      <h2 className="display-font mt-1 text-2xl font-black text-[#354172]">ライティング練習</h2>
      <div className="mt-4 grid gap-4">
        {prompts.map((prompt) => (
          <article key={prompt.writing_prompt_id} className="rounded-[22px] border border-[#d8e8f8] bg-[#f8fcff] p-4">
            <span className="rounded-full bg-[#fff7d6] px-3 py-1 text-xs font-black text-[#75622c]">
              {prompt.writing_type === 'email' ? 'Eメール問題' : '意見論述問題'}
            </span>
            <p className="mt-3 whitespace-pre-line text-sm font-bold leading-7 text-[#405174]">{prompt.prompt_ja}</p>
            <p className="mt-3 rounded-[16px] bg-white/86 p-3 text-sm font-bold leading-7 text-[#354172]">{prompt.prompt_en}</p>
            <p className="mt-2 text-xs font-black text-[#7d8db5]">{prompt.min_words}〜{prompt.max_words} words</p>
            {showSamples && prompt.sample_answer && (
              <div className="mt-3 rounded-[16px] bg-[#eefbf1] p-3 text-sm font-bold leading-7 text-[#2f6b42]">
                <p>{prompt.sample_answer}</p>
                {prompt.sample_answer_ja && <p className="mt-2 text-xs">{prompt.sample_answer_ja}</p>}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Eiken3QuizPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const questions = quiz?.questions || [];
  const currentQuestion = questions[currentIndex] || null;
  const selectedAnswer = currentQuestion ? answers[currentQuestion.question_id] || '' : '';
  const passageMap = useMemo(() => {
    const map = new Map();
    (quiz?.passages || result?.passages || []).forEach((passage) => map.set(passage.passage_id, passage));
    return map;
  }, [quiz, result]);
  const currentPassage = currentQuestion?.passage_id ? passageMap.get(currentQuestion.passage_id) : null;
  const answeredCount = Object.values(answers).filter(Boolean).length;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getEiken3Quiz(setId)
      .then((payload) => {
        if (!active) return;
        setQuiz(payload);
        setCurrentIndex(0);
        setAnswers({});
        setResult(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || '英検3級問題を読み込めませんでした。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [setId]);

  const submitQuiz = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = await submitEiken3Quiz({
        setId,
        answers: questions.map((question) => ({
          question_id: question.question_id,
          selected_option: answers[question.question_id] || '',
        })),
      });
      setResult(payload);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || '採点できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <>
        <WebLearningLayout title="英検3級 模擬テスト" subtitle={result.set_id}>
          <section className="panel p-5 md:p-7">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8fa0c2]">Result</p>
            <h1 className="display-font mt-2 text-3xl font-black text-[#354172]">結果 {result.score} / {result.total}</h1>
            <p className="mt-2 text-sm font-bold text-[#60709d]">正答率 {result.score_percent}%</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate('/eiken3')} className="ghost-button px-5 py-3">セット一覧へ</button>
              <button type="button" onClick={() => setResult(null)} className="pill-button px-5 py-3">問題へ戻る</button>
            </div>
          </section>

          <section className="mt-5 grid gap-4">
            {result.results.map((question) => {
              const isCorrect = question.is_correct;
              return (
                <article key={question.question_id} className={`rounded-[24px] border p-4 shadow-[0_12px_26px_rgba(145,177,209,0.12)] ${isCorrect ? 'border-emerald-100 bg-emerald-50/90' : 'border-rose-100 bg-rose-50/90'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-[#52668c]">Q{String(question.question_no).padStart(2, '0')} ・ {getQuestionSection(question)}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {isCorrect ? '正解' : '不正解'}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-base font-black leading-7 text-[#354172]">{question.prompt}</p>
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option) => {
                      const isRight = option.key === question.correct_option;
                      const isSelected = option.key === question.selected_option;
                      return (
                        <div key={option.key} className={`rounded-[16px] border px-3 py-2 text-sm font-bold ${isRight ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : isSelected ? 'border-rose-300 bg-rose-100 text-rose-800' : 'border-white bg-white/80 text-[#405174]'}`}>
                          {option.key}. {option.text}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm font-black text-[#354172]">
                    あなたの答え: {question.selected_option || '未回答'} / 正解: {question.correct_option}
                  </p>
                  {question.explanation_ja && <p className="mt-2 rounded-[16px] bg-white/74 p-3 text-sm font-bold leading-7 text-[#405174]">{question.explanation_ja}</p>}
                </article>
              );
            })}
          </section>

          <WritingPrompts prompts={result.writingPrompts || []} showSamples />
        </WebLearningLayout>
        <EQBottomNav />
      </>
    );
  }

  return (
    <>
      <WebLearningLayout title="英検3級 模擬テスト" subtitle={setId}>
        <section className="panel p-5 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8fa0c2]">EIKEN GRADE 3</p>
              <h1 className="display-font mt-2 text-3xl font-black text-[#354172]">{setId}</h1>
              <p className="mt-2 text-sm font-bold text-[#60709d]">回答 {answeredCount} / {questions.length || '-'}</p>
            </div>
            <Link to="/eiken3" className="ghost-button inline-flex justify-center px-5 py-3 text-sm">セット一覧へ</Link>
          </div>
        </section>

        {error && <div className="mt-4 rounded-[22px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        {loading ? (
          <div className="mt-5 rounded-[24px] bg-white/76 p-6 text-center font-bold text-[#6f7da8]">問題を読み込み中...</div>
        ) : currentQuestion ? (
          <section className="mt-5 grid gap-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {questions.map((question, index) => (
                <button
                  key={question.question_id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-10 min-w-10 rounded-full text-sm font-black ${index === currentIndex ? 'bg-[#26376d] text-white' : answers[question.question_id] ? 'bg-[#fff7d6] text-[#75622c]' : 'bg-white/86 text-[#60709d]'}`}
                >
                  {question.question_no}
                </button>
              ))}
            </div>

            <PassageCard passage={currentPassage} />

            <article className="rounded-[26px] border border-white/80 bg-white/90 p-5 text-[#354172] shadow-[0_16px_36px_rgba(129,164,199,0.13)]">
              <p className="text-sm font-black text-[#7d8db5]">
                Q{String(currentQuestion.question_no).padStart(2, '0')} / {questions.length} ・ {getQuestionSection(currentQuestion)}
              </p>
              <h2 className="mt-3 whitespace-pre-line text-xl font-black leading-8">{currentQuestion.prompt}</h2>
              {currentQuestion.question_text_ja && <p className="mt-2 text-sm font-bold text-[#60709d]">{currentQuestion.question_text_ja}</p>}
              <div className="mt-5 grid gap-3">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: option.key }))}
                    className={`rounded-[18px] border px-4 py-3 text-left text-sm font-black transition ${selectedAnswer === option.key ? 'border-[#f1cf5d] bg-[#fff4b8] text-[#354172]' : 'border-[#d8e8f8] bg-[#f8fcff] text-[#405174] hover:bg-white'}`}
                  >
                    {option.key}. {option.text}
                    {option.text_ja ? <span className="mt-1 block text-xs text-[#7d8db5]">{option.text_ja}</span> : null}
                  </button>
                ))}
              </div>
            </article>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                disabled={currentIndex === 0}
                className="ghost-button px-5 py-3 disabled:opacity-40"
              >
                前へ
              </button>
              {currentIndex < questions.length - 1 ? (
                <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} className="pill-button px-5 py-3">
                  次へ
                </button>
              ) : (
                <button type="button" onClick={submitQuiz} disabled={submitting} className="pill-button px-5 py-3 disabled:opacity-40">
                  {submitting ? '採点中...' : '採点する'}
                </button>
              )}
            </div>

            <WritingPrompts prompts={quiz?.writingPrompts || []} />
          </section>
        ) : (
          <div className="mt-5 rounded-[24px] bg-white/76 p-6 text-center font-bold text-[#6f7da8]">表示できる問題がありません。</div>
        )}
      </WebLearningLayout>
      <EQBottomNav />
    </>
  );
}
