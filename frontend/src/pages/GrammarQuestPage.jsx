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
import { getGrammarLesson, getGrammarLessons, submitGrammarLessonTest, submitGrammarQuizAnswer } from '../api';
import { useChildren } from '../ChildrenContext';
import { savePendingRewardQueue } from '../helpers/eigoQuestRewards';

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

function shuffleChoiceIndexes(choices) {
  const entries = choices.map((choice, originalIndex) => ({ choice, originalIndex }));
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
  }
  return entries;
}

function normalizeQuestions(apiLesson = {}) {
  const quizzes = Array.isArray(apiLesson.quizzes) ? apiLesson.quizzes : [];
  return quizzes
    .map((quiz, index) => {
      const rawChoices = (quiz.choices || [quiz.choice_a, quiz.choice_b, quiz.choice_c, quiz.choice_d]).filter(Boolean);
      const shuffledChoices = shuffleChoiceIndexes(rawChoices);
      return {
        id: quiz.quizId || quiz.quiz_id || `quiz-${index}`,
        quizId: quiz.quizId || quiz.quiz_id,
        prompt: quiz.questionJp || quiz.question_jp || quiz.questionText || quiz.question_text || '',
        choices: shuffledChoices.map((entry) => entry.choice),
        choiceIndexes: shuffledChoices.map((entry) => entry.originalIndex),
        explanation: quiz.explanationJp || quiz.explanation || quiz.explanation_jp || '',
      };
    })
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

function collectRewardQueue(results) {
  return (results || []).flatMap((result) => {
    const queue = result?.reward_queue || result?.rewardQueue || [];
    return Array.isArray(queue) ? queue : [];
  });
}

function lessonPointContent(lesson) {
  if (lesson?.patterns?.length) return lesson.patterns;
  return lesson?.learningGoal || lesson?.jpExplanation || 'この文法の使い方を例文で確認しよう。';
}

function LessonDetailCard({ icon, iconImage, title, tone = 'gold', children, className = '' }) {
  return (
    <EQFantasyCard className={`eq-grammar-lesson-card is-${tone} ${className}`} hideHeader>
      <div className="eq-grammar-lesson-card__icon" aria-hidden="true">
        {iconImage ? <img src={iconImage} alt="" /> : icon}
      </div>
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
  const [finalizing, setFinalizing] = useState(false);

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
        setFinalizing(false);
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
    setFinalizing(false);
  };

  const submitAnswer = async () => {
    if (!currentQuestion || selectedIndex === null || feedback) return;
    const selectedOriginalIndex = currentQuestion.choiceIndexes?.[selectedIndex] ?? selectedIndex;
    try {
      const result = await submitGrammarQuizAnswer({
        childId: selectedChildId,
        quizId: currentQuestion.quizId,
        selectedIndex: selectedOriginalIndex,
      });
      const correctOriginalIndex = Number(result.correctIndex);
      const displayedCorrectIndex = currentQuestion.choiceIndexes?.indexOf(correctOriginalIndex);
      const nextFeedback = {
        quizId: currentQuestion.quizId,
        isCorrect: Boolean(result.isCorrect),
        selectedIndex,
        selectedOriginalIndex,
        correctIndex: displayedCorrectIndex >= 0 ? displayedCorrectIndex : correctOriginalIndex,
        explanation: result.explanationJp || currentQuestion.explanation || '',
        reward_queue: result.reward_queue,
        rewardQueue: result.rewardQueue,
      };
      setFeedback(nextFeedback);
      setAnswers((items) => [...items, nextFeedback]);
    } catch (err) {
      setError(err.message || '答えを保存できませんでした。');
    }
  };

  const goNextQuestion = async () => {
    if (questionIndex >= questions.length - 1) {
      const completedAnswers = feedback && !answers.some((answer) => answer.quizId === feedback.quizId)
        ? [...answers, feedback]
        : answers;
      setAnswers(completedAnswers);
      setFinalizing(true);
      try {
        const testResult = await submitGrammarLessonTest({
          childId: selectedChildId,
          lessonId: lesson?.lessonId,
          answers: completedAnswers.map((answer) => ({
            quiz_id: answer.quizId,
            selected_index: answer.selectedOriginalIndex,
          })),
        });
        const rewardQueue = collectRewardQueue([testResult, ...completedAnswers]);
        if (rewardQueue.length) {
          savePendingRewardQueue(rewardQueue.map((reward) => ({
            ...reward,
            rewardType: reward.rewardType || reward.reward_type || 'grammar_lesson',
            lessonId: reward.lessonId || reward.lesson_id || lesson?.lessonId || '',
            returnTo: reward.returnTo || reward.return_to || '/grammar',
          })));
          navigate('/card-reward');
          return;
        }
      } catch (err) {
        setError(err.message || 'テスト結果を保存できませんでした。');
      } finally {
        setFinalizing(false);
      }
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
      />

      {error ? <div className="eq-grammar-rpg-message is-error">{error}</div> : null}

      {loading || !lesson ? (
        <div className="eq-grammar-rpg-message">文法レッスンを読み込んでいます...</div>
      ) : mode === 'lesson' ? (
        <>
          <LessonDetailCard iconImage={EQ_ASSETS.ui.iconStudy} title="ターゲット" tone="target">
            <p>{lesson.grammarPoint}</p>
          </LessonDetailCard>

          <LessonDetailCard iconImage={EQ_ASSETS.ui.grammarScroll} title="ルール" tone="rule">
            <p>{highlightText(lesson.jpExplanation)}</p>
          </LessonDetailCard>

          {(lesson.enExample || lesson.jpExample) ? (
            <LessonDetailCard iconImage={EQ_ASSETS.ui.wordBook} title="例文" tone="example" className="eq-grammar-lesson-card--example">
              <div className="eq-grammar-lesson-example">
                <div>
                  {lesson.enExample ? <strong>{lesson.enExample}</strong> : null}
                  {lesson.jpExample ? <p>{lesson.jpExample}</p> : null}
                </div>
                {lesson.enExample ? (
                  <EQAudioButton onClick={() => speakExample(lesson.enExample)} label="例文を再生">
                    再生
                  </EQAudioButton>
                ) : null}
              </div>
            </LessonDetailCard>
          ) : null}

          <LessonDetailCard iconImage={EQ_ASSETS.ui.bookIcon} title="ポイント" tone="point">
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
              <EQFantasyButton variant="dark" className="eq-grammar-lesson-neighbor-button" onClick={() => navigateLesson(previousLesson)} disabled={!previousLesson}>
                ← 前の文法へ戻る
              </EQFantasyButton>
              <EQFantasyButton variant="blue" className="eq-grammar-lesson-neighbor-button" onClick={() => navigateLesson(nextLesson)} disabled={!nextLesson}>
                次の文法へ進む →
              </EQFantasyButton>
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
                disabled={selectedIndex === null || finalizing}
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

