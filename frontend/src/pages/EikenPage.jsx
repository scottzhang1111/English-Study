import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import PetDisplay from '../components/PetDisplay';
import TtsButton from '../components/TtsButton';
import {
  EQBadge,
  EQBottomNav,
  EQChoiceButton,
  EQInfoCard,
  EQMobileShell,
  EQPanel,
  EQPrimaryButton,
  EQSecondaryButton,
} from '../components/eigo';
import { getEikenQuestions, getReviewList, submitPracticeAnswer } from '../api';
import CompactPageHeader from '../components/eigo/CompactPageHeader';

const EIKEN_ASSET_BASE = '/assets/eigo-quest/learning-hub';
const EIKEN_TOWER_IMAGE = `${EIKEN_ASSET_BASE}/英検クエスト.png`;
const EIKEN_TRIAL_IMAGE = `${EIKEN_ASSET_BASE}/英検本番形式.png`;

export default function EikenPage() {
  const childId = localStorage.getItem('selected_child_id') || '';
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [reviewList, setReviewList] = useState([]);
  const [reviewError, setReviewError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionSource, setQuestionSource] = useState('rule');
  const [sourceWarning, setSourceWarning] = useState('');
  const [importance, setImportance] = useState('ALL');
  const [frequency, setFrequency] = useState('ALL');
  const [earnedExp, setEarnedExp] = useState(0);
  const [petResult, setPetResult] = useState(null);

  const loadQuestions = ({ forceAi = false } = {}) => {
    setLoading(true);
    setError(null);
    getEikenQuestions({
      childId,
      forceAi,
      importance: importance === 'ALL' ? '' : importance,
      frequency: frequency === 'ALL' ? '' : frequency,
    })
      .then((data) => {
        setQuestions(data.questions || []);
        setQuestionSource(data.source || 'rule');
        setSourceWarning(data.warning || '');
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setFeedback('');
        setCorrectCount(0);
        setAnsweredCount(0);
        setEarnedExp(0);
        setPetResult(null);
      })
      .catch((err) => setError(err.message || '問題の読み込みに失敗しました。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  const handleSelect = async (choice) => {
    if (!currentQuestion || selectedAnswer) return;
    setSelectedAnswer(choice);
    try {
      const result = await submitPracticeAnswer({
        id: currentQuestion.id,
        word: currentQuestion.word,
        selected: choice,
        correct: currentQuestion.correct,
        childId,
      });

      setAnsweredCount((prev) => prev + 1);
      setEarnedExp(result.pet_exp_awarded || 0);
      setPetResult(result.pet || null);

      if (result.correct) {
        setCorrectCount((prev) => prev + 1);
        setFeedback('正解です。');
      } else {
        setFeedback(`正解は ${result.correct_answer} です。`);
      }
    } catch (err) {
      setFeedback(err.message);
    }
  };

  const loadReview = () => {
    setReviewError(null);
    getReviewList(childId)
      .then((data) => setReviewList(data.review_list || []))
      .catch((err) => setReviewError(err.message || '復習リストの読み込みに失敗しました。'));
  };

  const showNext = () => {
    setSelectedAnswer(null);
    setFeedback('');
    setPetResult(null);
    setEarnedExp(0);
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
  };

  const showPrev = () => {
    setSelectedAnswer(null);
    setFeedback('');
    setPetResult(null);
    setEarnedExp(0);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="eq-eiken-trial-page">
      <EQMobileShell className="eq-eiken-trial-shell">
        <CompactPageHeader
          title="英検クエスト"
          subtitle="実戦力をためそう"
          backgroundImage="/assets/eigo-quest/learning-hub/英検クエスト.png"
          elementLabel="英"
          progressText={`正解 ${correctCount} / ${answeredCount}`}
          helperImage="/assets/eigo-quest/spirit_assets/happy.png"
          variant="eiken"
        />
        <header className="eq-eiken-trial-hero" style={{ '--eiken-hero-image': `url("${EIKEN_TOWER_IMAGE}")` }}>
          <div className="eq-eiken-trial-crest" aria-hidden="true">英</div>
          <div className="eq-eiken-trial-hero-copy">
            <span>Eiken Trial Tower</span>
            <h1>英検クエスト</h1>
            <p>実戦力をためそう</p>
          </div>
          <div className="eq-eiken-trial-hero-stats">
            <EQBadge tone="gold">正解 {correctCount}</EQBadge>
            <EQBadge tone="green">挑戦 {answeredCount}</EQBadge>
          </div>
        </header>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="eq-eiken-trial-stack">
          <EQPanel title="試練の紋章" eyebrow="Tower Gate" tone="gold" className="eq-eiken-trial-filter-panel">
            <p className="eq-caption">重要度と出現頻度を選んで、英検の試練に挑戦しよう。</p>
            <div className="eq-eiken-trial-filter-grid">
              <label className="eq-eiken-trial-select-label">
                重要度
                <select value={importance} onChange={(event) => setImportance(event.target.value)}>
                  <option value="ALL">すべて</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <label className="eq-eiken-trial-select-label">
                出現頻度
                <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                  <option value="ALL">すべて</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
            </div>
            <EQPrimaryButton type="button" onClick={() => loadQuestions()} fullWidth>
              試練を更新
            </EQPrimaryButton>
          </EQPanel>

          {loading ? (
            <EQPanel tone="cyan" className="eq-eiken-trial-message-panel">
              <p className="eq-caption text-center">試練を準備しています...</p>
            </EQPanel>
          ) : error ? (
            <EQPanel title="読み込みエラー" tone="rose" className="eq-eiken-trial-message-panel">
              <p className="eq-caption">{error}</p>
              <EQPrimaryButton type="button" onClick={() => loadQuestions()} fullWidth>
                もう一度読み込む
              </EQPrimaryButton>
            </EQPanel>
          ) : !currentQuestion ? (
            <EQPanel tone="gold" className="eq-eiken-trial-message-panel">
              <p className="eq-caption text-center">出題できる問題がありません。</p>
            </EQPanel>
          ) : (
            <EQPanel
              title="試練の問題"
              eyebrow={`Question ${currentIndex + 1} / ${questions.length}`}
              tone="gold"
              className="eq-eiken-trial-question-panel"
            >
              <div className="eq-eiken-trial-progress-card" style={{ '--eiken-trial-image': `url("${EIKEN_TRIAL_IMAGE}")` }}>
                <div>
                  <span>Trial Progress</span>
                  <strong>{progressPercent}%</strong>
                </div>
                <div className="eq-eiken-trial-progress-bar" style={{ '--eiken-progress': `${progressPercent}%` }} />
              </div>

              <div className="eq-eiken-trial-badges">
                <EQBadge tone="cyan">{questionSource === 'ai' ? 'AI生成' : 'ルール生成'}</EQBadge>
                <EQBadge tone="gold">正解 {correctCount} / {answeredCount}</EQBadge>
              </div>

              <EQInfoCard
                title={currentQuestion.type || '問題'}
                value={currentQuestion.id ? `ID ${currentQuestion.id}` : ''}
                badges={sourceWarning ? <EQBadge tone="amber">Notice</EQBadge> : null}
                tone="amber"
                className="eq-eiken-trial-question-card"
              >
                {sourceWarning ? <p className="mb-3">{sourceWarning}</p> : null}
                <p className="eq-eiken-trial-question-text">{currentQuestion.question}</p>
              </EQInfoCard>

              <div className="eq-eiken-trial-choice-grid">
                {currentQuestion.choices.map((choice) => {
                  const isSelected = selectedAnswer === choice;
                  const isCorrect = choice === currentQuestion.correct;

                  return (
                    <EQChoiceButton
                      key={choice}
                      type="button"
                      onClick={() => handleSelect(choice)}
                      disabled={!!selectedAnswer}
                      correct={!!selectedAnswer && isCorrect}
                      wrong={!!selectedAnswer && isSelected && !isCorrect}
                      selected={isSelected}
                      className="eq-eiken-trial-choice"
                    >
                      {choice}
                    </EQChoiceButton>
                  );
                })}
              </div>

              {selectedAnswer && (
                <>
                  {feedback && (
                    <EQPanel tone={selectedAnswer === currentQuestion.correct ? 'green' : 'rose'} className="eq-eiken-trial-result-panel">
                      <p className="eq-caption">{feedback}</p>
                    </EQPanel>
                  )}

                  {petResult && (
                    <EQPanel tone="gold" className="eq-eiken-trial-pet-panel">
                      <PetDisplay pet={petResult} earnedExp={earnedExp} compact />
                    </EQPanel>
                  )}

                  <EQInfoCard title="解説" tone="cyan" className="eq-eiken-trial-explain-card">
                    {currentQuestion.word && (
                      <div className="eq-eiken-trial-audio-row">
                        <p>{currentQuestion.word}</p>
                        <TtsButton text={currentQuestion.word} label="Word" />
                      </div>
                    )}
                    {currentQuestion.japanese && (
                      <>
                        <p className="eq-eiken-trial-explain-heading">日本語訳</p>
                        <p>{currentQuestion.japanese}</p>
                      </>
                    )}
                    {currentQuestion.example && (
                      <>
                        <p className="eq-eiken-trial-explain-heading">英文例</p>
                        <div className="eq-eiken-trial-audio-row">
                          <p>{currentQuestion.example}</p>
                          <TtsButton text={currentQuestion.example} label="Example" />
                        </div>
                      </>
                    )}
                    {currentQuestion.example_jp && (
                      <>
                        <p className="eq-eiken-trial-explain-heading">和訳例</p>
                        <p>{currentQuestion.example_jp}</p>
                      </>
                    )}
                    {currentQuestion.sentence_jp && (
                      <>
                        <p className="eq-eiken-trial-explain-heading">例文</p>
                        <p>{currentQuestion.sentence_jp}</p>
                      </>
                    )}
                    {currentQuestion.explanation_jp && (
                      <>
                        <p className="eq-eiken-trial-explain-heading">解説</p>
                        <p>{currentQuestion.explanation_jp}</p>
                      </>
                    )}
                  </EQInfoCard>
                </>
              )}

              <div className="eq-eiken-trial-actions">
                <EQSecondaryButton type="button" onClick={showPrev} disabled={currentIndex === 0} fullWidth>
                  前へ
                </EQSecondaryButton>
                <EQPrimaryButton type="button" onClick={showNext} disabled={currentIndex >= questions.length - 1} fullWidth>
                  次へ
                </EQPrimaryButton>
                <EQSecondaryButton type="button" onClick={loadReview} fullWidth>
                  復習リストを見る
                </EQSecondaryButton>
                <EQSecondaryButton type="button" onClick={() => loadQuestions({ forceAi: true })} fullWidth>
                  20問を再生成
                </EQSecondaryButton>
              </div>

              {reviewError && (
                <EQPanel title="復習リストエラー" tone="rose" className="eq-eiken-trial-message-panel">
                  <p className="eq-caption">{reviewError}</p>
                </EQPanel>
              )}

              {reviewList.length > 0 && (
                <EQPanel title="復習リスト" tone="purple" className="eq-eiken-trial-review-panel">
                  <div className="eq-eiken-trial-review-list">
                    {reviewList.map((item) => (
                      <EQInfoCard
                        key={item.word_id}
                        title={item.word}
                        badges={<EQBadge tone="amber">誤答 {item.error_count}</EQBadge>}
                        tone="purple"
                      >
                        <div className="eq-eiken-trial-audio-row">
                          <p>{item.japanese}</p>
                          <TtsButton text={item.word} label="Word" />
                        </div>
                      </EQInfoCard>
                    ))}
                  </div>
                </EQPanel>
              )}
            </EQPanel>
          )}
        </motion.div>
      </EQMobileShell>
      <EQBottomNav className="eq-eiken-trial-bottom-nav" />
    </div>
  );
}
