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
import { createMissionReward } from '../helpers/eigoQuestRewards';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

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

  return {
    title: apiLesson.title || MOCK_LESSON.title,
    subtitle: apiLesson.category || apiLesson.learningGoal || MOCK_LESSON.subtitle,
    rule: apiLesson.grammarPoint || apiLesson.jpExplanation || MOCK_LESSON.rule,
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
  const [mode, setMode] = useState('lesson');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState('');
  const [answers, setAnswers] = useState([]);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [error, setError] = useState('');
  const fromDailyQuest = searchParams.get('from') === 'daily-quest';

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
    getGrammarLessons(selectedChildId)
      .then((payload) => {
        const lessons = payload.lessons || [];
        const lessonId = payload.todayLesson?.lessonId || lessons[0]?.lessonId;
        if (!lessonId) throw new Error('No grammar lesson found.');
        return getGrammarLesson({ childId: selectedChildId, lessonId });
      })
      .then((payload) => {
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
  }, [selectedChildId]);

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
      createMissionReward({
        childId: selectedChildId,
        learnedWordsCount: Number(homeData?.progress || 20),
      });
      navigate('/card-reward');
    } catch (err) {
      setError(err.message || 'Reward could not be created.');
      setRewardSaving(false);
    }
  };

  return (
    <div className="quest-grammar-mobile-intro">
      <EQMobileShell className="eq-grammar-screen quest-grammar-learn-page">
        <CompactPageHeader
          title="文法クエスト"
          subtitle={fromDailyQuest ? '今日の文法をクリアしよう' : 'ルールを覚えて挑戦しよう'}
          backgroundImage="/assets/eigo-quest/learning-hub/文法の神殿.png"
          elementLabel="文"
          progressText={mode === 'quiz' ? `${questionIndex + 1} / ${questions.length}` : 'LESSON'}
          helperImage="/assets/eigo-quest/spirit_assets/happy.png"
          variant="grammar"
        />
        <header className="quest-grammar-header quest-header">
          <button type="button" className="quest-back-button" onClick={() => navigate(-1)} aria-label="Back">
            ‹
          </button>
          <div className="quest-header-copy">
            <h1>Grammar Quest</h1>
            <p>{fromDailyQuest ? 'Daily Quest' : 'Grammar Practice'}</p>
          </div>
          <span className="quest-header-star" aria-hidden="true">✦</span>
        </header>

        {mode === 'lesson' && (
          <>
            <MagicPanel className="quest-grammar-learn-panel">
              <span className="quest-grammar-label">LESSON</span>
              <h2>{lessonLoading ? 'Loading grammar...' : lesson.title}</h2>
              <p className="quest-grammar-rule">
                {lessonLoading ? 'Grammar quest is preparing the next lesson.' : lesson.rule}
              </p>
              {usingMockFallback && !lessonLoading && (
                <p className="text-xs font-bold text-amber-200">Fallback lesson</p>
              )}
            </MagicPanel>

            <EQCard className="quest-grammar-point-card">
              <span>例文</span>
              <ul>
                {lesson.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </EQCard>

            <GoldQuestButton onClick={startQuiz} disabled={lessonLoading || !questions.length} className="quest-grammar-next">
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
