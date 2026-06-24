import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  EQBottomNav,
  EQ_ASSETS,
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
  const grammarPoint = apiLesson.grammarPoint || apiLesson.grammar_point || '';
  const jpExplanation = apiLesson.jpExplanation || apiLesson.jp_explanation || '';
  const enExample = apiLesson.enExample || apiLesson.en_example || '';
  const jpExample = apiLesson.jpExample || apiLesson.jp_example || '';
  const learningGoal = apiLesson.learningGoal || apiLesson.learning_goal || '';
  const patterns = normalizePatterns(apiLesson.patterns || apiLesson.patterns_json || apiLesson.patternsJson);

  return {
    lessonId: apiLesson.lessonId || apiLesson.lesson_id || apiLesson.id || '',
    level: apiLesson.level || '',
    category: apiLesson.category || '',
    title: apiLesson.title || MOCK_LESSON.title,
    subtitle: apiLesson.category || learningGoal || MOCK_LESSON.subtitle,
    displayOrder: Number(apiLesson.displayOrder || apiLesson.display_order || 0),
    learningGoal,
    grammarPoint,
    jpExplanation,
    enExample,
    jpExample,
    patterns,
    rule: grammarPoint || jpExplanation || MOCK_LESSON.rule,
    examples: examples.length ? examples : MOCK_LESSON.examples,
  };
}

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
        return {
          pattern: item[0] || '',
          meaningJa: item[1] || '',
          exampleEn: item[2] || '',
        };
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

function highlightGrammarText(text = '') {
  if (!text) return null;
  const pattern = /(had\s*\+\s*過去分詞|am\s*\/\s*is\s*\/\s*are|would|could|might|doing|to do|do|~ing)/gi;
  return String(text).split(pattern).map((part, index) => {
    if (!part) return null;
    if (pattern.test(part)) {
      pattern.lastIndex = 0;
      return <mark key={`${part}-${index}`}>{part}</mark>;
    }
    pattern.lastIndex = 0;
    return <span key={`${part}-${index}`}>{part}</span>;
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

export default function GrammarQuestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedChildId } = useChildren();
  const [homeData, setHomeData] = useState(null);
  const [lesson, setLesson] = useState(() => buildFallbackLesson());
  const [lessonList, setLessonList] = useState([]);
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
  const [targetExpanded, setTargetExpanded] = useState(false);
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
        setLessonList(lessons);
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
        setMode('lesson');
        setTargetExpanded(false);
      })
      .catch(() => {
        setLesson(buildFallbackLesson());
        setQuestions(buildFallbackQuestions());
        setUsingMockFallback(true);
      })
      .finally(() => setLessonLoading(false));
  }, [requestedLessonId, selectedChildId]);

  const currentQuestion = questions[questionIndex] || questions[0];
  const currentLessonIndex = useMemo(
    () => lessonList.findIndex((item) => item.lessonId === lesson.lessonId),
    [lesson.lessonId, lessonList],
  );
  const previousLesson = currentLessonIndex > 0 ? lessonList[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex >= 0 && currentLessonIndex < lessonList.length - 1
    ? lessonList[currentLessonIndex + 1]
    : null;
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
  const categoryLabel = lesson.category || '文法';
  const breadcrumb = `文法の塔 > ${categoryLabel} > ${lesson.title || 'レッスン'}`;
  const summaryGoal = lesson.learningGoal || lesson.grammarPoint || '文法の使い方を文の中で確認しよう。';
  const targetText = lesson.grammarPoint || summaryGoal;
  const ruleText = lesson.jpExplanation || lesson.rule || 'このレッスンのルールを確認して、クイズで使ってみよう。';
  const pointItems = lesson.patterns?.length
    ? lesson.patterns
    : [{ pattern: 'ポイント', meaningJa: ruleText, exampleEn: lesson.enExample || '' }];

  const navigateLesson = (targetLesson) => {
    if (!targetLesson?.lessonId) return;
    navigate(`/grammar-quest?lessonId=${encodeURIComponent(targetLesson.lessonId)}`);
  };

  return (
    <div className="quest-grammar-mobile-intro">
      <EQMobileShell className="eq-grammar-screen quest-grammar-learn-page">
        <header className="quest-grammar-header quest-header">
          <button type="button" className="quest-back-button" onClick={() => navigate(-1)} aria-label="Back">
            ‹
          </button>
          <div className="quest-header-copy">
            <h1>{mode === 'lesson' ? '文法レッスン' : 'Grammar Quiz'}</h1>
            <p>{mode === 'quiz' ? `${questionIndex + 1} / ${questions.length}` : breadcrumb}</p>
          </div>
          <img src={EQ_ASSETS.spirit.happy} alt="" className="quest-grammar-header-spirit" />
        </header>

        {mode === 'lesson' && (
          <>
            <section className="eq-grammar-detail-stack" aria-label="文法レッスン">
              <EQCard className={`eq-grammar-summary-card ${lessonLoading ? 'is-loading' : ''}`.trim()} glow={false}>
                <div className="eq-grammar-summary-badge">
                  <span>LESSON</span>
                  <strong>{lesson.displayOrder || currentLessonIndex + 1 || '-'}</strong>
                  <small>{categoryLabel}</small>
                </div>
                <div className="eq-grammar-summary-copy">
                  <h2>{lessonTitle}</h2>
                  <p>{lessonLoading ? 'レッスンを読み込んでいます。' : summaryGoal}</p>
                </div>
              </EQCard>

              <EQCard className="eq-grammar-detail-card eq-grammar-target-card" glow={false}>
                <div className="eq-grammar-card-title">
                  <span aria-hidden="true">🎯</span>
                  <h3>ターゲット</h3>
                </div>
                <p className={targetExpanded ? 'is-expanded' : ''}>{targetText}</p>
                {targetText.length > 80 ? (
                  <button type="button" onClick={() => setTargetExpanded((value) => !value)}>
                    {targetExpanded ? '閉じる' : 'もっと見る'}
                  </button>
                ) : null}
              </EQCard>

              <EQCard className="eq-grammar-detail-card eq-grammar-rule-card" glow={false}>
                <div className="eq-grammar-card-title">
                  <span aria-hidden="true">📜</span>
                  <h3>ルール</h3>
                </div>
                <p>{highlightGrammarText(ruleText)}</p>
              </EQCard>

              {(lesson.enExample || lesson.jpExample) ? (
                <EQCard className="eq-grammar-detail-card eq-grammar-example-card" glow={false}>
                  <div className="eq-grammar-card-title">
                    <span aria-hidden="true">🔊</span>
                    <h3>例文</h3>
                  </div>
                  <div className="eq-grammar-example-row">
                    {lesson.enExample ? (
                      <button type="button" className="eq-grammar-play-button" onClick={() => speakExample(lesson.enExample)}>
                        再生
                      </button>
                    ) : null}
                    <div>
                      {lesson.enExample ? <p className="eq-grammar-example-en">{lesson.enExample}</p> : null}
                      {lesson.jpExample ? <p className="eq-grammar-example-ja">{lesson.jpExample}</p> : null}
                    </div>
                  </div>
                </EQCard>
              ) : null}

              <EQCard className="eq-grammar-detail-card eq-grammar-pattern-card" glow={false}>
                <div className="eq-grammar-card-title">
                  <span aria-hidden="true">💡</span>
                  <h3>{lesson.patterns?.length ? 'ポイント・句型リスト' : 'ポイント'}</h3>
                </div>
                <div className="eq-grammar-pattern-list">
                  {pointItems.map((item, index) => (
                    <article key={`${item.pattern}-${index}`} className="eq-grammar-pattern-item">
                      <strong>{item.pattern}</strong>
                      {item.meaningJa ? <p>{item.meaningJa}</p> : null}
                      {item.exampleEn ? <small>{item.exampleEn}</small> : null}
                    </article>
                  ))}
                </div>
              </EQCard>

              {usingMockFallback && !lessonLoading && (
                <p className="text-xs font-bold text-amber-200">Fallback lesson</p>
              )}
            </section>

            <div className="eq-grammar-detail-actions">
              <GoldQuestButton onClick={startQuiz} disabled={lessonLoading || preparingMessage || !questions.length} className="quest-grammar-next">
                クイズへ進む
              </GoldQuestButton>
              <div className="eq-grammar-neighbor-actions">
                <button type="button" onClick={() => navigateLesson(previousLesson)} disabled={!previousLesson}>
                  前の文法へ戻る
                </button>
                <button type="button" onClick={() => navigateLesson(nextLesson)} disabled={!nextLesson}>
                  次の文法へ進む
                </button>
              </div>
            </div>
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
