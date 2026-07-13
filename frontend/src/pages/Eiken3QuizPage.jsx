import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EQBottomNav } from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
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

function PageShell({ children, progressText, isResult = false }) {
  return (
    <>
      <div className="eiken-exam-page eiken-real-trial-page eiken3-mock-page mx-auto max-w-[1440px] px-3 pb-28 pt-2 text-[#26376d] lg:px-5 lg:py-4">
        <div className="eiken-real-trial-compact-wrap md:hidden">
          <CompactPageHeader
            title="英検3級"
            subtitle={isResult ? '結果を確認しよう' : '模擬テストに挑戦'}
            backgroundImage="/assets/eigo-quest/learning-hub/英検本番形式.png"
            elementLabel="英"
            progressText={progressText}
            helperImage="/assets/eigo-quest/spirit_assets/happy.png"
            variant="eiken-real"
          />
        </div>
        <main className="eiken-real-trial-practice-layout">
          {children}
        </main>
      </div>
      <EQBottomNav className="eiken-real-trial-bottom-nav" />
    </>
  );
}

function PassageCard({ passage }) {
  if (!passage) return null;
  return (
    <section className="eiken3-mock-passage-card">
      <div className="eiken3-mock-card-head">
        <span>{passage.passage_type || passage.genre || 'Passage'}</span>
        <strong>{passage.title}</strong>
      </div>
      {passage.title_ja && <p className="eiken3-mock-muted">{passage.title_ja}</p>}
      <p className="eiken3-mock-passage-text">{passage.passage_text}</p>
      {passage.key_points_ja && (
        <p className="eiken3-mock-note">{passage.key_points_ja}</p>
      )}
    </section>
  );
}

function WritingPrompts({ prompts = [], showSamples = false }) {
  if (!prompts.length) return null;
  return (
    <section className="eiken3-mock-writing-card">
      <div className="eiken3-mock-card-head">
        <span>Writing</span>
        <strong>ライティング練習</strong>
      </div>
      <div className="eiken3-mock-writing-list">
        {prompts.map((prompt) => (
          <article key={prompt.writing_prompt_id} className="eiken3-mock-writing-item">
            <b>{prompt.writing_type === 'email' ? 'Eメール問題' : '意見論述問題'}</b>
            <p>{prompt.prompt_ja}</p>
            <p className="eiken3-mock-prompt-en">{prompt.prompt_en}</p>
            <small>{prompt.min_words}〜{prompt.max_words} words</small>
            {showSamples && prompt.sample_answer && (
              <div className="eiken3-mock-sample-answer">
                <p>{prompt.sample_answer}</p>
                {prompt.sample_answer_ja && <p>{prompt.sample_answer_ja}</p>}
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
  const [searchParams] = useSearchParams();
  const part = searchParams.get('part') || 'part1';
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
    getEiken3Quiz(setId, part)
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
  }, [setId, part]);

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
      <PageShell progressText={`${result.score} / ${result.total}`} isResult>
        <section className="eiken-real-trial-result-panel eiken3-mock-result-panel">
          <div className="eiken-real-trial-result-hero">
            <div>
              <p>RESULT</p>
              <h2>結果 {result.score} / {result.total}</h2>
              <strong>正答率 {result.score_percent}%</strong>
            </div>
            <div className="eiken-real-trial-result-actions">
              <button type="button" onClick={() => navigate('/eiken3')} className="eiken-real-trial-result-button">
                セット一覧へ
              </button>
              <button type="button" onClick={() => setResult(null)} className="eiken-real-trial-result-button">
                問題へ戻る
              </button>
            </div>
          </div>

          <div className="eiken3-mock-result-list">
            {result.results.map((question) => {
              const isCorrect = question.is_correct;
              return (
                <article key={question.question_id} className={`eiken3-mock-result-card ${isCorrect ? 'is-correct' : 'is-wrong'}`}>
                  <div className="eiken3-mock-result-head">
                    <p>Q{String(question.question_no).padStart(2, '0')} / {getQuestionSection(question)}</p>
                    <span>{isCorrect ? '正解' : '不正解'}</span>
                  </div>
                  <h3>{question.prompt}</h3>
                  <div className="eiken3-mock-result-options">
                    {question.options.map((option) => {
                      const isRight = option.key === question.correct_option;
                      const isSelected = option.key === question.selected_option;
                      return (
                        <div
                          key={option.key}
                          className={`${isRight ? 'is-right' : ''} ${isSelected && !isRight ? 'is-selected-wrong' : ''}`}
                        >
                          {option.key}. {option.text}
                        </div>
                      );
                    })}
                  </div>
                  <p className="eiken3-mock-answer-line">
                    あなたの答え: {question.selected_option || '未回答'} / 正解: {question.correct_option}
                  </p>
                  {question.explanation_ja && <p className="eiken3-mock-explanation">{question.explanation_ja}</p>}
                </article>
              );
            })}
          </div>

          <WritingPrompts prompts={result.writingPrompts || []} showSamples />
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell progressText={`${answeredCount} / ${questions.length || '-'}`}>
      <section className="eiken-real-trial-quiz-panel eiken3-mock-quiz-panel">
        <div className="eiken-real-trial-quiz-header">
          <div>
            <p>EIKEN GRADE 3</p>
            <h2>{setId}</h2>
            <strong>回答 {answeredCount} / {questions.length || '-'}</strong>
          </div>
          <Link to="/eiken3" className="eiken-real-trial-secondary-action eiken3-mock-top-link">
            セット一覧へ
          </Link>
        </div>

        {error && <div className="eiken3-mock-alert">{error}</div>}

        {loading ? (
          <div className="eiken-real-trial-status-card eiken3-mock-status" role="status" aria-live="polite">
            <span className="eiken-real-trial-status-orb" aria-hidden="true" />
            <p>読み込み中</p>
            <strong>問題を準備しています...</strong>
          </div>
        ) : currentQuestion ? (
          <div className="eiken3-mock-quiz-stack">
            <div className="eiken3-mock-question-nav">
              {questions.map((question, index) => (
                <button
                  key={question.question_id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`${index === currentIndex ? 'is-current' : ''} ${answers[question.question_id] ? 'is-answered' : ''}`}
                >
                  {question.question_no}
                </button>
              ))}
            </div>

            <PassageCard passage={currentPassage} />

            <article className="eiken3-mock-question-card">
              <p>
                Q{String(currentQuestion.question_no).padStart(2, '0')} / {questions.length}
                <span>{getQuestionSection(currentQuestion)}</span>
              </p>
              <h2>{currentQuestion.prompt}</h2>
              {currentQuestion.question_text_ja && <p className="eiken3-mock-muted">{currentQuestion.question_text_ja}</p>}
              <div className="eiken3-mock-options">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: option.key }))}
                    className={selectedAnswer === option.key ? 'is-selected' : ''}
                  >
                    <b>{option.key}</b>
                    <span>
                      {option.text}
                      {option.text_ja ? <small>{option.text_ja}</small> : null}
                    </span>
                  </button>
                ))}
              </div>
            </article>

            <div className="eiken-real-trial-quiz-actions">
              <button
                type="button"
                onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                disabled={currentIndex === 0}
                className="eiken-real-trial-secondary-action"
              >
                前へ
              </button>
              {currentIndex < questions.length - 1 ? (
                <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} className="eiken-real-trial-gold-action">
                  次へ
                </button>
              ) : (
                <button type="button" onClick={submitQuiz} disabled={submitting} className="eiken-real-trial-gold-action">
                  {submitting ? '採点中...' : '採点する'}
                </button>
              )}
            </div>

            <WritingPrompts prompts={quiz?.writingPrompts || []} />
          </div>
        ) : (
          <div className="eiken-real-trial-status-card eiken3-mock-status">
            <span className="eiken-real-trial-status-orb" aria-hidden="true" />
            <p>表示できる問題がありません。</p>
          </div>
        )}
      </section>
    </PageShell>
  );
}
