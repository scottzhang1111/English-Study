import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  EQBottomNav,
  EQCard,
  EQMobileShell,
  GoldQuestButton,
  MagicPanel,
} from '../components/eigo';
import {
  getGrammarLesson,
  getGrammarLessons,
  getHomeData,
  submitGrammarQuizAnswer,
} from '../api';
import { useChildren } from '../ChildrenContext';

const PASS_SCORE = 2;

const MOCK_LESSON = {
  title: 'be動詞の魔法',
  subtitle: 'am / is / are を選んで、文を完成させよう',
  rule: '主語が I なら am、he / she / it なら is、you / we / they なら are を使います。',
  examples: [
    'I am happy.',
    'She is kind.',
    'They are friends.',
  ],
};

const MOCK_QUESTIONS = [
  {
    prompt: 'I ___ a student.',
    answer: 'am',
    choices: ['am', 'is', 'are'],
  },
  {
    prompt: 'He ___ my brother.',
    answer: 'is',
    choices: ['am', 'is', 'are'],
  },
  {
    prompt: 'They ___ in the park.',
    answer: 'are',
    choices: ['am', 'is', 'are'],
  },
];

function buildFallbackLesson() {
  return {
    title: MOCK_LESSON.title,
    subtitle: MOCK_LESSON.subtitle,
    rule: MOCK_LESSON.rule,
    examples: MOCK_LESSON.examples,
  };
}

function buildFallbackQuestions() {
  return MOCK_QUESTIONS.map((question, index) => ({
    id: `mock-${index}`,
    prompt: question.prompt,
    answer: question.answer,
    choices: question.choices,
    isMock: true,
  }));
}

function normalizeLesson(apiLesson) {
  if (!apiLesson) return buildFallbackLesson();

  const examples = [apiLesson.enExample, apiLesson.jpExample].filter(Boolean);
  const grammarPoint = apiLesson.grammarPoint || '';
  const jpExplanation = apiLesson.jpExplanation || '';
  const enExample = apiLesson.enExample || '';
  const jpExample = apiLesson.jpExample || '';

  return {
    title: apiLesson.title || MOCK_LESSON.title,
    subtitle: apiLesson.category || apiLesson.learningGoal || MOCK_LESSON.subtitle,
    grammarPoint,
    jpExplanation,
    enExample,
    jpExample,
    rule: grammarPoint || jpExplanation || MOCK_LESSON.rule,
    examples: examples.length ? examples : MOCK_LESSON.examples,
  };
}

function normalizeQuestions(apiLesson) {
  const quizzes = Array.isArray(apiLesson?.quizzes) ? apiLesson.quizzes : [];
  if (!quizzes.length) return [];

  return quizzes
    .map((quiz, index) => ({
      id: quiz.quizId || `api-${index}`,
      quizId: quiz.quizId,
      prompt: quiz.questionJp || quiz.prompt || MOCK_QUESTIONS[index % MOCK_QUESTIONS.length].prompt,
      choices: (quiz.choices || []).filter(Boolean),
      isMock: false,
    }))
    .filter((question) => question.choices.length > 0);
}

export default function GrammarQuestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedChildId } = useChildren();
  const [homeData, setHomeData] = useState(null);
  const [lesson, setLesson] = useState(() => buildFallbackLesson());
  const [questions, setQuestions] = useState(() => buildFallbackQuestions());
  const [usingMockFallback, setUsingMockFallback] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(true);
  const [preparingMessage, setPreparingMessage] = useState('');
  const [mode, setMode] = useState('lesson');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState('');
  const [answers, setAnswers] = useState([]);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [error, setError] = useState('');
  const fromDailyQuest = searchParams.get('from') === 'daily-quest';
  const requestedLessonId = searchParams.get('lessonId') || '';

  useEffect(() => {
    if (!selectedChildId) return;
    getHomeData(selectedChildId)
      .then(setHomeData)
      .catch(() => setHomeData(null));
  }, [selectedChildId]);

  useEffect(() => {
    if (!selectedChildId) {
      setLesson(buildFallbackLesson());
      setQuestions(buildFallbackQuestions());
      setUsingMockFallback(true);
      setLessonLoading(false);
      return;
    }

    setLessonLoading(true);
    setPreparingMessage('');
    getGrammarLessons(selectedChildId)
      .then((payload) => {
        if (payload.preparing) {
          setPreparingMessage(payload.message || '3級文法は準備中です');
          setQuestions([]);
          setUsingMockFallback(false);
          return null;
        }
        const lessons = payload.lessons || [];
        const requestedLesson = lessons.find((item) => item.lessonId === requestedLessonId);
        const lessonId = requestedLesson?.lessonId || payload.todayLesson?.lessonId || lessons[0]?.lessonId;
        if (!lessonId) throw new Error('No grammar lesson found.');
        return getGrammarLesson({ childId: selectedChildId, lessonId });
      })
      .then((payload) => {
        if (!payload) return;
        const apiLesson = payload.lesson;
        const nextQuestions = normalizeQuestions(apiLesson);
        if (!apiLesson || !nextQuestions.length) throw new Error('No grammar quiz found.');
        setLesson(normalizeLesson(apiLesson));
        setQuestions(nextQuestions);
        setUsingMockFallback(false);
        setError('');
      })
      .catch(() => {
        setLesson(buildFallbackLesson());
        setQuestions(buildFallbackQuestions());
        setUsingMockFallback(true);
      })
      .finally(() => setLessonLoading(false));
  }, [requestedLessonId, selectedChildId]);

  const currentQuestion = questions[questionIndex] || questions[0];
  const score = useMemo(
    () => answers.filter((answer) => answer.correct).length,
    [answers],
  );
  const passed = score >= PASS_SCORE;

  const startQuiz = () => {
    setMode('quiz');
    setQuestionIndex(0);
    setSelectedChoice('');
    setAnswers([]);
    setError('');
  };

  const submitAnswer = async () => {
    if (!selectedChoice) return;
    const selectedIndex = currentQuestion.choices.findIndex((choice) => choice === selectedChoice);
    if (selectedIndex < 0) return;

    let answerPayload = {
      prompt: currentQuestion.prompt,
      selected: selectedChoice,
      correctAnswer: currentQuestion.answer,
      correct: selectedChoice === currentQuestion.answer,
    };

    if (!currentQuestion.isMock && currentQuestion.quizId) {
      try {
        const result = await submitGrammarQuizAnswer({
          childId: selectedChildId,
          quizId: currentQuestion.quizId,
          selectedIndex,
        });
        answerPayload = {
          prompt: currentQuestion.prompt,
          selected: selectedChoice,
          correctAnswer: currentQuestion.choices[result.correctIndex] || '',
          correct: Boolean(result.isCorrect),
        };
      } catch (err) {
        setError(err.message || 'Answer could not be saved.');
        return;
      }
    }

    const nextAnswers = [...answers, answerPayload];
    setAnswers(nextAnswers);
    setSelectedChoice('');

    if (questionIndex >= questions.length - 1) {
      setMode('result');
      return;
    }

    setQuestionIndex((index) => index + 1);
  };

  const retryLesson = () => {
    setMode('lesson');
    setQuestionIndex(0);
    setSelectedChoice('');
    setAnswers([]);
    setError('');
  };

  const claimReward = () => {
    if (!selectedChildId) return;
    setRewardSaving(true);
    setError('');
    try {
      navigate('/grammar');
    } catch (err) {
      setError(err.message || 'Reward could not be created.');
      setRewardSaving(false);
    }
  };

  const lessonTitle = lessonLoading ? 'Loading grammar...' : preparingMessage || lesson.title;
  const lessonSubtitle = fromDailyQuest ? 'Daily Quest' : lesson.subtitle || 'Grammar Practice';
  const detailRows = [
    lesson.grammarPoint ? { label: '文法ポイント', value: lesson.grammarPoint } : null,
    lesson.jpExplanation ? { label: '説明', value: lesson.jpExplanation } : null,
  ].filter(Boolean);
  const exampleRows = [
    lesson.enExample ? { label: 'English', value: lesson.enExample } : null,
    lesson.jpExample ? { label: '日本語', value: lesson.jpExample } : null,
  ].filter(Boolean);
  const fallbackExamples = !exampleRows.length ? lesson.examples : [];

  return (
    <div className="quest-grammar-mobile-intro">
      <EQMobileShell className="eq-grammar-screen quest-grammar-learn-page">
        <header className="quest-grammar-header quest-header">
          <button type="button" className="quest-back-button" onClick={() => navigate(-1)} aria-label="Back">
            ‹
          </button>
          <div className="quest-header-copy">
            <h1>{mode === 'lesson' ? '文法レッスン' : 'Grammar Quiz'}</h1>
            <p>{mode === 'quiz' ? `${questionIndex + 1} / ${questions.length}` : lessonSubtitle}</p>
          </div>
          <span className="quest-header-star" aria-hidden="true">✦</span>
        </header>

        {mode === 'lesson' && (
          <>
            <section className={`eq-grammar-learning-card ${lessonLoading ? 'is-loading' : ''}`.trim()} aria-label="文法レッスン">
              <span className="eq-grammar-learning-badge">LESSON</span>
              <div className="eq-grammar-test-topic">
                <span className="eq-grammar-test-emblem" aria-hidden="true">Grammar</span>
                <div>
                  <p>学習テーマ</p>
                  <h2>{lessonTitle}</h2>
                </div>
                <div>
                  <p>ルール</p>
                  <strong>{lessonLoading ? 'Grammar quest is preparing the next lesson.' : preparingMessage || lesson.rule}</strong>
                </div>
              </div>

              {detailRows.length ? (
                <EQCard className="eq-grammar-point-card" glow={false}>
                  <span>要点</span>
                  <ul>
                    {detailRows.map((row) => (
                      <li key={row.label}>
                        <strong>{row.label}: </strong>
                        {row.value}
                      </li>
                    ))}
                  </ul>
                </EQCard>
              ) : null}

              {!preparingMessage && (exampleRows.length || fallbackExamples.length) ? (
                <EQCard className="eq-grammar-example-card" glow={false}>
                  <span>例文</span>
                  <div>
                    {exampleRows.map((row) => (
                      <p key={row.label}>
                        {row.value}
                        <span>{row.label}</span>
                      </p>
                    ))}
                    {!exampleRows.length ? fallbackExamples.map((example) => (
                      <p key={example}>{example}</p>
                    )) : null}
                  </div>
                </EQCard>
              ) : null}

              {usingMockFallback && !lessonLoading && (
                <p className="text-xs font-bold text-amber-200">Fallback lesson</p>
              )}
            </section>

            <GoldQuestButton onClick={startQuiz} disabled={lessonLoading || preparingMessage || !questions.length} className="quest-grammar-next">
              クイズへ
            </GoldQuestButton>
          </>
        )}

        {mode === 'quiz' && (
          <MagicPanel className="quest-grammar-test-panel">
            <div className="quest-grammar-test-meta">
              <span className="quest-grammar-test-label">
                {questionIndex + 1} / {questions.length}
              </span>
            </div>
            <h2 className="quest-grammar-test-question">{currentQuestion.prompt}</h2>
            <div className="quest-grammar-test-options">
              {currentQuestion.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`eq-choice-button ${selectedChoice === choice ? 'is-selected' : ''}`.trim()}
                  onClick={() => setSelectedChoice(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
            <GoldQuestButton
              onClick={submitAnswer}
              disabled={!selectedChoice}
              className="quest-grammar-test-submit"
            >
              決定
            </GoldQuestButton>
          </MagicPanel>
        )}

        {mode === 'result' && (
          <MagicPanel className="eq-grammar-state-card quest-grammar-test-state">
            <span className="quest-grammar-test-label">RESULT</span>
            <h1>{passed ? 'CLEAR!' : 'TRY AGAIN'}</h1>
            <p>{score} / {questions.length}</p>
            <p>
              {passed
                ? '文法の魔法をクリアしました。カード報酬へ進みましょう。'
                : 'もう一度レッスンを見てから挑戦しましょう。'}
            </p>
            {error && <p className="text-sm font-bold text-rose-300">{error}</p>}
            {passed ? (
              <GoldQuestButton onClick={claimReward} disabled={rewardSaving} className="quest-grammar-next">
                カードへ
              </GoldQuestButton>
            ) : (
              <GoldQuestButton onClick={retryLesson} className="quest-grammar-next">
                もう一度
              </GoldQuestButton>
            )}
          </MagicPanel>
        )}
      </EQMobileShell>
      <EQBottomNav />
    </div>
  );
}
