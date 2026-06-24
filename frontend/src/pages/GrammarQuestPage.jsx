import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CompactPageHeader,
  EQ_ASSETS,
  EQAudioButton,
  EQChoiceButton,
  EQFantasyButton,
  EQFantasyCard,
  EQPageShell,
  EQProgressBar,
  EQQuestionCard,
} from '../components/eigo';
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
    return HIGHLIGHT_RE.test(part)
      ? <mark key={`${part}-${index}`}>{part}</mark>
      : <span key={`${part}-${index}`}>{part}</span>;
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

function lessonPointContent(lesson) {
  if (lesson?.patterns?.length) return lesson.patterns;
  return lesson?.learningGoal || lesson?.jpExplanation || 'この文法の使い方を例文で確認しよう。';
}

function LessonDetailCard({ icon, title, children, className = '' }) {
  return (
    <EQFantasyCard className={`eq-grammar-lesson-card ${className}`} hideHeader>
      <div className="eq-grammar-lesson-card__icon" aria-hidden="true">{icon}</div>
      <div className="eq-grammar-lesson-card__copy">
        <h2>{title}</h2>
        {children}
      </div>
    </EQFantasyCard>
  );
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
  const pointContent = lessonPointContent(lesson);

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

  const goPreviousQuestion = () => {
    if (questionIndex <= 0 || feedback) return;
    setQuestionIndex((index) => index - 1);
    setSelectedIndex(null);
    setFeedback(null);
  };

  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const pageTitle = mode === 'quiz' ? '文法テスト' : '文法レッスン';
  const lessonGoal = lesson?.learningGoal || lesson?.grammarPoint || '';
  const pageSubtitle = mode === 'quiz'
    ? `${lesson?.title || ''}\n${questions.length || 5}問チャレンジ！`
    : [lesson?.title, lessonGoal].filter(Boolean).join('\n');
  const quizProgressValue = questions.length ? questionIndex + 1 : 0;
  const quizProgressPercent = questions.length
    ? Math.round((quizProgressValue / questions.length) * 100)
    : 0;

  return (
    <EQPageShell
      className="eq-grammar-rpg-wrap"
      contentClassName={`eq-grammar-rpg-page eq-grammar-rpg-quest-page ${mode === 'lesson' ? 'eq-grammar-lesson-detail-page' : ''} ${mode === 'quiz' ? 'eq-grammar-test-page-v2' : ''}`}
      withBottomNav
      bottomNavClassName="eq-learning-hub-bottom-nav"
      maxWidth="430px"
    >
      <CompactPageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        backgroundImage={mode === 'quiz' ? EQ_ASSETS.bg.grammarPractice : EQ_ASSETS.bg.grammarTemple}
        helperImage={EQ_ASSETS.spirit.happy}
        guidanceText={undefined}
        elementLabel={undefined}
        variant="grammar"
        action={mode === 'quiz' ? (
          <button type="button" className="eq-grammar-rpg-back" onClick={() => navigate(-1)} aria-label="戻る">
            ←
          </button>
        ) : undefined}
      />

      {error ? <div className="eq-grammar-rpg-message is-error">{error}</div> : null}

      {loading || !lesson ? (
        <div className="eq-grammar-rpg-message">文法レッスンを読み込んでいます...</div>
      ) : mode === 'lesson' ? (
        <>
          <LessonDetailCard icon="🎯" title="ターゲット">
            <p>{lesson.grammarPoint}</p>
          </LessonDetailCard>

          <LessonDetailCard icon="📜" title="ルール">
            <p>{highlightText(lesson.jpExplanation)}</p>
          </LessonDetailCard>

          {(lesson.enExample || lesson.jpExample) ? (
            <LessonDetailCard icon="🔊" title="例文" className="eq-grammar-lesson-card--example">
              <div className="eq-grammar-lesson-example">
                {lesson.enExample ? (
                  <EQAudioButton onClick={() => speakExample(lesson.enExample)} label="例文を再生">
                    再生
                  </EQAudioButton>
                ) : null}
                <div>
                  {lesson.enExample ? <strong>{lesson.enExample}</strong> : null}
                  {lesson.jpExample ? <p>{lesson.jpExample}</p> : null}
                </div>
              </div>
            </LessonDetailCard>
          ) : null}

          <LessonDetailCard icon="💡" title="ポイント">
            {Array.isArray(pointContent) ? (
              <div className="eq-grammar-rpg-patterns">
                {visiblePatterns.map((item, index) => (
                  <article key={`${item.pattern}-${index}`}>
                    <strong>{item.pattern}</strong>
                    {item.meaningJa ? <p>{item.meaningJa}</p> : null}
                    {item.exampleEn ? <small>{item.exampleEn}</small> : null}
                  </article>
                ))}
                {lesson.patterns.length > 3 ? (
                  <button type="button" className="eq-grammar-rpg-link-button" onClick={() => setShowAllPatterns((value) => !value)}>
                    {showAllPatterns ? '最初の3個だけ見る' : `すべての ${lesson.patterns.length} 個の表現を見る`}
                  </button>
                ) : null}
              </div>
            ) : (
              <p>{pointContent}</p>
            )}
          </LessonDetailCard>

          <div className="eq-grammar-rpg-detail-actions">
            <EQFantasyButton fullWidth className="eq-grammar-lesson-cta" onClick={startQuiz} disabled={!questions.length}>
              理解した！テストへ進む
            </EQFantasyButton>
            <div className="eq-grammar-lesson-neighbor-actions">
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
          <section className="eq-grammar-test-progress-card" aria-label="Quiz progress">
            <div className="eq-grammar-test-progress-row">
              <strong>Question {quizProgressValue} / {questions.length}</strong>
              <span>{quizProgressPercent}%</span>
            </div>
            <EQProgressBar
              value={quizProgressValue}
              max={questions.length}
              label={`Question ${quizProgressValue} / ${questions.length}`}
              showText={false}
            />
          </section>

          <EQQuestionCard className="eq-grammar-rpg-question-card">
            <h2 className="eq-grammar-test-prompt">{currentQuestion.prompt}</h2>
            <div className="eq-grammar-rpg-choices">
              {currentQuestion.choices.map((choice, index) => {
                const isSelected = selectedIndex === index;
                const isCorrect = feedback && feedback.correctIndex === index;
                const isWrong = feedback && isSelected && !feedback.isCorrect;
                const isDimmed = feedback && !isSelected && !isCorrect;
                const choiceClasses = [
                  'eq-grammar-test-choice',
                  isDimmed ? 'is-dimmed' : '',
                ].filter(Boolean).join(' ');
                return (
                  <EQChoiceButton
                    key={`${choice}-${index}`}
                    badge={choiceLetter(index)}
                    selected={isSelected}
                    correct={Boolean(isCorrect)}
                    wrong={Boolean(isWrong)}
                    className={choiceClasses}
                    onClick={() => !feedback && setSelectedIndex(index)}
                    disabled={Boolean(feedback)}
                  >
                    {choice}
                  </EQChoiceButton>
                );
              })}
            </div>

            {feedback ? (
              <section className={`eq-grammar-rpg-explanation ${feedback.isCorrect ? 'is-correct' : 'is-wrong'}`}>
                <h3>{feedback.isCorrect ? '正解！' : 'もう少し！'}</h3>
                <p>正解: {choiceLetter(feedback.correctIndex)} {currentQuestion.choices[feedback.correctIndex]}</p>
                <p>選んだ答え: {choiceLetter(feedback.selectedIndex)} {currentQuestion.choices[feedback.selectedIndex]}</p>
                {feedback.explanation ? <small>{feedback.explanation}</small> : null}
              </section>
            ) : null}

            <div className="eq-grammar-test-nav">
              <EQFantasyButton
                variant="dark"
                className="eq-grammar-test-prev"
                onClick={goPreviousQuestion}
                disabled={questionIndex === 0 || Boolean(feedback)}
              >
                前へ
              </EQFantasyButton>
              <EQFantasyButton
                className="eq-grammar-test-next"
                onClick={feedback ? goNextQuestion : submitAnswer}
                disabled={selectedIndex === null}
              >
                {feedback && questionIndex >= questions.length - 1 ? '結果を見る' : '次へ'}
              </EQFantasyButton>
            </div>
          </EQQuestionCard>
        </>
      ) : (
        <EQQuestionCard className="eq-grammar-rpg-card eq-grammar-rpg-result">
          <h2>{correctCount >= Math.ceil(questions.length * 0.8) ? 'CLEAR!' : 'もう一度やってみよう'}</h2>
          <p>{correctCount} / {questions.length}</p>
          <EQFantasyButton fullWidth onClick={() => navigate('/grammar')}>文法の塔へ戻る</EQFantasyButton>
        </EQQuestionCard>
      )}
    </EQPageShell>
  );
}

