import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  EQBottomNav,
  EQCard,
  EQMobileShell,
  GoldQuestButton,
  MagicPanel,
} from '../components/eigo';
import { getHomeData } from '../api';
import { useChildren } from '../ChildrenContext';
import { createMissionReward } from '../helpers/eigoQuestRewards';

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

export default function GrammarQuestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedChildId } = useChildren();
  const [homeData, setHomeData] = useState(null);
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

  const currentQuestion = MOCK_QUESTIONS[questionIndex];
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

  const submitAnswer = () => {
    if (!selectedChoice) return;
    const nextAnswers = [
      ...answers,
      {
        prompt: currentQuestion.prompt,
        selected: selectedChoice,
        correctAnswer: currentQuestion.answer,
        correct: selectedChoice === currentQuestion.answer,
      },
    ];
    setAnswers(nextAnswers);
    setSelectedChoice('');

    if (questionIndex >= MOCK_QUESTIONS.length - 1) {
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
              <h2>{MOCK_LESSON.title}</h2>
              <p className="quest-grammar-rule">{MOCK_LESSON.rule}</p>
            </MagicPanel>

            <EQCard className="quest-grammar-point-card">
              <span>例文</span>
              <ul>
                {MOCK_LESSON.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </EQCard>

            <GoldQuestButton onClick={startQuiz} className="quest-grammar-next">
              クイズへ
            </GoldQuestButton>
          </>
        )}

        {mode === 'quiz' && (
          <MagicPanel className="quest-grammar-test-panel">
            <div className="quest-grammar-test-meta">
              <span className="quest-grammar-test-label">
                {questionIndex + 1} / {MOCK_QUESTIONS.length}
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
            <p>{score} / {MOCK_QUESTIONS.length}</p>
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
