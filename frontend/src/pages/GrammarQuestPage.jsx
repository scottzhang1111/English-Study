import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EQ_ASSETS, EQBottomNav, EQFantasyButton, EQMobileShell } from '../components/eigo';
import { getGrammarLesson, getGrammarLessons, submitGrammarQuizAnswer } from '../api';
import { useChildren } from '../ChildrenContext';

const HIGHLIGHT_RE = /(am|is|are|doing|to do|do|~ing)/gi;

function normalizePatterns(rawPatterns) {
  let patterns = rawPatterns;
  if (typeof rawPatterns === 'string' && rawPatterns.trim()) {
    try {
      patterns = JSON.parse(rawPatterns);
    } catch {
      patterns = [];
    }
  }
  if (!Array.isArray(patterns)) return [];
  return patterns
    .map((item) => {
      if (Array.isArray(item)) {
        return { pattern: item[0] || '', meaningJa: item[1] || '', exampleEn: item[2] || '' };
      }
      if (!item || typeof item !== 'object') return null;
      return {
        pattern: item.pattern || item.title || '',
        meaningJa: item.meaningJa || item.meaning || item.jp || item.ja || '',
        exampleEn: item.exampleEn || item.example || item.en || '',
      };
    })
    .filter((item) => item?.pattern);
}

function normalizeLesson(apiLesson = {}) {
  const grammarPoint = apiLesson.grammarPoint || apiLesson.grammar_point || '';
  const jpExplanation = apiLesson.jpExplanation || apiLesson.jp_explanation || '';
  const enExample = apiLesson.enExample || apiLesson.en_example || '';
  const jpExample = apiLesson.jpExample || apiLesson.jp_example || '';
  const learningGoal = apiLesson.learningGoal || apiLesson.learning_goal || '';
  return {
    lessonId: apiLesson.lessonId || apiLesson.lesson_id || apiLesson.id || '',
    title: apiLesson.title || '文法レッスン',
    category: apiLesson.category || '文法項目',
    displayOrder: Number(apiLesson.displayOrder || apiLesson.display_order || 0),
    grammarPoint,
    jpExplanation,
    enExample,
    jpExample,
    learningGoal,
    patterns: normalizePatterns(apiLesson.patterns || apiLesson.patterns_json || apiLesson.patternsJson),
  };
}

function normalizeQuestions(apiLesson = {}) {
  const quizzes = Array.isArray(apiLesson.quizzes) ? apiLesson.quizzes : [];
  return quizzes
    .map((quiz, index) => ({
      id: quiz.quizId || quiz.quiz_id || `quiz-${index}`,
      quizId: quiz.quizId || quiz.quiz_id,
      prompt: quiz.questionJp || quiz.question_jp || quiz.questionText || quiz.question_text || '',
      choices: (quiz.choices || [quiz.choice_a, quiz.choice_b, quiz.choice_c, quiz.choice_d]).filter(Boolean),
      explanation: quiz.explanationJp || quiz.explanation || quiz.explanation_jp || '',
    }))
    .filter((question) => question.prompt && question.choices.length);
}

function highlightText(text = '') {
  return String(text).split(HIGHLIGHT_RE).map((part, index) => {
    if (!part) return null;
    HIGHLIGHT_RE.lastIndex = 0;
    return HIGHLIGHT_RE.test(part) ? <mark key={`${part}-${index}`}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>;
  });
}

function speakExample(text) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function choiceLetter(index) {
  return String.fromCharCode(65 + index);
}

export default function GrammarQuestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedChildId } = useChildren();
  const requestedLessonId = searchParams.get('lessonId') || '';
  const [lesson, setLesson] = useState(null);
  const [lessonList, setLessonList] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [mode, setMode] = useState('lesson');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    if (!selectedChildId) {
      navigate('/select-child', { replace: true });
      return;
    }

    setLoading(true);
    setError('');
    getGrammarLessons(selectedChildId)
      .then((payload) => {
        const lessons = payload.lessons || [];
        setLessonList(lessons);
        const requested = lessons.find((item) => item.lessonId === requestedLessonId);
        const lessonId = requested?.lessonId || payload.todayLesson?.lessonId || lessons[0]?.lessonId;
        if (!lessonId) throw new Error('文法レッスンが見つかりません。');
        return getGrammarLesson({ childId: selectedChildId, lessonId });
      })
      .then((payload) => {
        const apiLesson = payload.lesson || {};
        setLesson(normalizeLesson(apiLesson));
        setQuestions(normalizeQuestions(apiLesson));
        setMode('lesson');
        setQuestionIndex(0);
        setSelectedIndex(null);
        setFeedback(null);
        setAnswers([]);
        setShowAllPatterns(false);
      })
      .catch((err) => setError(err.message || '文法レッスンを読み込めませんでした。'))
      .finally(() => setLoading(false));
  }, [navigate, requestedLessonId, selectedChildId]);

  const currentQuestion = questions[questionIndex] || null;
  const currentLessonIndex = useMemo(
    () => lessonList.findIndex((item) => item.lessonId === lesson?.lessonId),
    [lesson?.lessonId, lessonList],
  );
  const previousLesson = currentLessonIndex > 0 ? lessonList[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < lessonList.length - 1
    ? lessonList[currentLessonIndex + 1]
    : null;
  const visiblePatterns = showAllPatterns ? (lesson?.patterns || []) : (lesson?.patterns || []).slice(0, 3);
  const progressPercent = questions.length ? Math.round(((questionIndex + 1) / questions.length) * 100) : 0;

  const navigateLesson = (targetLesson) => {
    if (!targetLesson?.lessonId) return;
    navigate(`/grammar-quest?lessonId=${encodeURIComponent(targetLesson.lessonId)}`);
  };

  const startQuiz = () => {
    setMode('quiz');
    setQuestionIndex(0);
    setSelectedIndex(null);
    setFeedback(null);
    setAnswers([]);
  };

  const submitAnswer = async () => {
    if (!currentQuestion || selectedIndex === null || feedback) return;
    try {
      const result = await submitGrammarQuizAnswer({
        childId: selectedChildId,
        quizId: currentQuestion.quizId,
        selectedIndex,
      });
      const nextFeedback = {
        isCorrect: Boolean(result.isCorrect),
        selectedIndex,
        correctIndex: Number(result.correctIndex),
        explanation: result.explanationJp || currentQuestion.explanation || '',
      };
      setFeedback(nextFeedback);
      setAnswers((items) => [...items, nextFeedback]);
    } catch (err) {
      setError(err.message || '答えを保存できませんでした。');
    }
  };

  const goNextQuestion = () => {
    if (questionIndex >= questions.length - 1) {
      setMode('result');
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelectedIndex(null);
    setFeedback(null);
  };

  const correctCount = answers.filter((answer) => answer.isCorrect).length;

  return (
    <div className="eq-grammar-rpg-wrap">
      <EQMobileShell className="eq-grammar-rpg-page eq-grammar-rpg-quest-page">
        <header className="eq-grammar-rpg-header">
          <button type="button" className="eq-grammar-rpg-back" onClick={() => navigate(-1)} aria-label="戻る">
            ←
          </button>
          <div>
            <h1>{mode === 'quiz' ? '文法テスト' : '文法レッスン'}</h1>
            <p>{mode === 'quiz' ? lesson?.title : `文法の塔 > ${lesson?.category || '文法'} > ${lesson?.title || ''}`}</p>
          </div>
          <img src={EQ_ASSETS.spirit.happy} alt="" />
        </header>

        {error ? <div className="eq-grammar-rpg-message is-error">{error}</div> : null}

        {loading || !lesson ? (
          <div className="eq-grammar-rpg-message">文法レッスンを読み込んでいます...</div>
        ) : mode === 'lesson' ? (
          <>
            <section className="eq-grammar-rpg-summary">
              <div className="eq-grammar-rpg-summary-no">
                <span>LESSON</span>
                <strong>{lesson.displayOrder || currentLessonIndex + 1 || '-'}</strong>
                <small>{lesson.category}</small>
              </div>
              <div>
                <span className="eq-grammar-rpg-category">{lesson.category}</span>
                <h2>{lesson.title}</h2>
                <p>{lesson.learningGoal || lesson.grammarPoint}</p>
              </div>
            </section>

            <section className="eq-grammar-rpg-card">
              <h3>🎯 ターゲット</h3>
              <p>{lesson.grammarPoint}</p>
            </section>

            <section className="eq-grammar-rpg-card">
              <h3>📜 ルール</h3>
              <p>{highlightText(lesson.jpExplanation)}</p>
            </section>

            {(lesson.enExample || lesson.jpExample) ? (
              <section className="eq-grammar-rpg-card">
                <h3>🔊 例文</h3>
                <div className="eq-grammar-rpg-example">
                  {lesson.enExample ? (
                    <button type="button" onClick={() => speakExample(lesson.enExample)} aria-label="例文を再生">
                      ▶
                      <span>再生</span>
                    </button>
                  ) : null}
                  <div>
                    {lesson.enExample ? <strong>{lesson.enExample}</strong> : null}
                    {lesson.jpExample ? <p>{lesson.jpExample}</p> : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="eq-grammar-rpg-card">
              <h3>💡 ポイント（よく使う表現）</h3>
              {lesson.patterns.length ? (
                <>
                  <div className="eq-grammar-rpg-patterns">
                    {visiblePatterns.map((item, index) => (
                      <article key={`${item.pattern}-${index}`}>
                        <strong>{item.pattern}</strong>
                        {item.meaningJa ? <p>{item.meaningJa}</p> : null}
                        {item.exampleEn ? <small>{item.exampleEn}</small> : null}
                      </article>
                    ))}
                  </div>
                  {lesson.patterns.length > 3 ? (
                    <button type="button" className="eq-grammar-rpg-link-button" onClick={() => setShowAllPatterns((value) => !value)}>
                      {showAllPatterns ? '最初の3個だけ見る' : `すべての ${lesson.patterns.length} 個の表現を見る`}
                    </button>
                  ) : null}
                </>
              ) : (
                <p>{lesson.jpExplanation || lesson.learningGoal || 'この文法の使い方を例文で確認しよう。'}</p>
              )}
            </section>

            <div className="eq-grammar-rpg-detail-actions">
              <EQFantasyButton fullWidth onClick={startQuiz} disabled={!questions.length}>
                クイズへ進む
              </EQFantasyButton>
              <div>
                <button type="button" onClick={() => navigateLesson(previousLesson)} disabled={!previousLesson}>
                  ← 前の文法へ戻る
                </button>
                <button type="button" onClick={() => navigateLesson(nextLesson)} disabled={!nextLesson}>
                  次の文法へ進む →
                </button>
              </div>
            </div>
          </>
        ) : mode === 'quiz' && currentQuestion ? (
          <>
            <section className="eq-grammar-rpg-quiz-head">
              <span>{lesson.title}</span>
              <div>
                <strong>{questionIndex + 1}/{questions.length}</strong>
                <i><b style={{ width: `${progressPercent}%` }} /></i>
              </div>
            </section>

            <section className="eq-grammar-rpg-question-card">
              <h2>{currentQuestion.prompt}</h2>
              <div className="eq-grammar-rpg-choices">
                {currentQuestion.choices.map((choice, index) => {
                  const isSelected = selectedIndex === index;
                  const isCorrect = feedback && feedback.correctIndex === index;
                  const isWrong = feedback && isSelected && !feedback.isCorrect;
                  const isDimmed = feedback && !isSelected && !isCorrect;
                  return (
                    <button
                      key={`${choice}-${index}`}
                      type="button"
                      className={[
                        isSelected ? 'is-selected' : '',
                        isCorrect ? 'is-correct' : '',
                        isWrong ? 'is-wrong' : '',
                        isDimmed ? 'is-dimmed' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => !feedback && setSelectedIndex(index)}
                      disabled={Boolean(feedback)}
                    >
                      <span>{choiceLetter(index)}</span>
                      {choice}
                    </button>
                  );
                })}
              </div>
            </section>

            {feedback ? (
              <section className={`eq-grammar-rpg-explanation ${feedback.isCorrect ? 'is-correct' : 'is-wrong'}`}>
                <h3>{feedback.isCorrect ? '正解！' : 'もう少し！'}</h3>
                <p>正解: {choiceLetter(feedback.correctIndex)} {currentQuestion.choices[feedback.correctIndex]}</p>
                <p>選んだ答え: {choiceLetter(feedback.selectedIndex)} {currentQuestion.choices[feedback.selectedIndex]}</p>
                {feedback.explanation ? <small>{feedback.explanation}</small> : null}
              </section>
            ) : null}

            <EQFantasyButton
              fullWidth
              className="eq-grammar-rpg-quiz-button"
              onClick={feedback ? goNextQuestion : submitAnswer}
              disabled={selectedIndex === null}
            >
              {feedback ? (questionIndex >= questions.length - 1 ? '結果を見る' : '次の問題へ') : '答えを決定'}
            </EQFantasyButton>
          </>
        ) : (
          <section className="eq-grammar-rpg-card eq-grammar-rpg-result">
            <h2>{correctCount >= Math.ceil(questions.length * 0.8) ? 'CLEAR!' : 'もう一度やってみよう'}</h2>
            <p>{correctCount} / {questions.length}</p>
            <EQFantasyButton fullWidth onClick={() => navigate('/grammar')}>文法の塔へ戻る</EQFantasyButton>
          </section>
        )}
      </EQMobileShell>
      <EQBottomNav />
    </div>
  );
}
