import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TtsButton from '../components/TtsButton';
import WebLearningLayout from '../components/WebLearningLayout';
import {
  AudioButton,
  EQBottomNav,
  EQCard,
  EQChoiceButton,
  EQMobileShell,
  GoldQuestButton,
  MagicPanel,
  QuestHeader,
  QuestProgressStepper,
  SpiritGuide,
} from '../components/eigo';
import { getLearnedWords, getQuizData, submitPracticeAnswer } from '../api';

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function speak(text) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

export default function QuizPage() {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [usedWordIds, setUsedWordIds] = useState([]);
  const [emptyMessage, setEmptyMessage] = useState('');
  const navigate = useNavigate();

  const currentQuiz = questions[currentIndex] || null;
  const masteredCount = currentQuiz?.mastered_count ?? 0;
  const errorCount = currentQuiz?.error_count ?? 0;
  const isInitialLoading = loading && !currentQuiz;
  const isBatchComplete = questions.length > 0 && currentIndex >= questions.length;
  const hasNoReviewWords = (!loading && questions.length === 0) || (currentQuiz && (currentQuiz.choices || []).length === 0);
  const pageText = questions.length ? `${Math.min(currentIndex + 1, questions.length)} / ${questions.length}` : '- / -';
  const correctCount = answers.filter((item) => item.correct).length;
  const wrongAnswers = answers.filter((item) => !item.correct);
  const rightPanel = (
    <div className="rounded-3xl border border-white/80 bg-white/86 p-5 shadow-[0_16px_36px_rgba(129,164,199,0.14)] backdrop-blur">
      <p className="text-xs font-bold text-[#8fa0c2]">三択練習</p>
      <h2 className="mt-2 text-2xl font-bold text-[#31406f]">{pageText}</h2>
      <div className="mt-5 grid gap-3 text-sm font-bold text-[#60709d]">
        <div className="rounded-2xl bg-[#f8fcff] p-3">正解: {correctCount}</div>
        <div className="rounded-2xl bg-[#fff8d9] p-3">ミス: {wrongAnswers.length}</div>
        <div className="rounded-2xl bg-[#f8fcff] p-3">モード: 4択クイズ</div>
      </div>
      <button type="button" onClick={() => navigate('/flashcard')} className="pill-button mt-5 w-full px-4 py-3 text-sm">
        単語を確認
      </button>
    </div>
  );

  const fetchQuizBatch = async ({ retryWrong = false } = {}) => {
    setLoading(true);
    setError(null);
    setEmptyMessage('');
    try {
      const childId = localStorage.getItem('selected_child_id') || '';
      const learnedPayload = await getLearnedWords(childId);
      const learnedWords = learnedPayload.words || [];
      if (learnedWords.length < 4) {
        setQuestions([]);
        setEmptyMessage('4択クイズには、覚えた単語が4つ以上必要です。まず単語カードで覚えましょう。');
        return;
      }

      const sourceWords = retryWrong
        ? wrongAnswers.map((item) => item.quiz).filter(Boolean)
        : learnedWords.filter((word) => !usedWordIds.includes(String(word.id || word.word)));
      const selectedWords = shuffleItems(sourceWords).slice(0, Math.min(10, sourceWords.length));

      if (selectedWords.length === 0) {
        setQuestions([]);
        setEmptyMessage('今回は出せる新しい問題がありません。単語をもっと覚えたら、また挑戦しましょう。');
        return;
      }

      const nextQuestions = await Promise.all(
        selectedWords.map((word) => getQuizData({ word: word.word || word.id, childId })),
      );
      setQuestions(nextQuestions);
      setCurrentIndex(0);
      setAnswer(null);
      setAnswers([]);
      setResult(null);
      setSubmittingAnswer(false);
      if (!retryWrong) {
        setUsedWordIds((prev) => [...prev, ...selectedWords.map((word) => String(word.id || word.word))]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizBatch();
  }, []);

  useEffect(() => {
    const saved = answers.find((item) => item.index === currentIndex);
    setAnswer(saved?.selected || null);
    setResult(null);
    setSubmittingAnswer(false);
  }, [currentIndex]);

  const openCard = () => {
    const word = currentQuiz?.word || currentQuiz?.correct;
    navigate(word ? `/flashcard?word=${encodeURIComponent(word)}` : '/flashcard');
  };

  const handleSelection = async (choice) => {
    if (!currentQuiz || answer || submittingAnswer || !currentQuiz.correct) return;
    setAnswer(choice);
    setSubmittingAnswer(true);
    const childId = localStorage.getItem('selected_child_id') || '';
    try {
      const payload = await submitPracticeAnswer({
        id: currentQuiz.id,
        word: currentQuiz.word,
        selected: choice,
        correct: currentQuiz.correct,
        childId,
      });
      setResult(payload);
      setAnswers((prev) => [
        ...prev.filter((item) => item.index !== currentIndex),
        {
          index: currentIndex,
          selected: choice,
          correct: choice === currentQuiz.correct,
          quiz: currentQuiz,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    setCurrentIndex(questions.length);
  };

  const quizProgressPercent = questions.length
    ? `${(Math.min(currentIndex + 1, questions.length) / questions.length) * 100}%`
    : '0%';
  const mobileQuestionCount = questions.length ? `${Math.min(currentIndex + 1, questions.length)} / ${questions.length}` : '- / -';
  const targetJapanese = currentQuiz?.japanese || currentQuiz?.meaning || currentQuiz?.jp || currentQuiz?.question || '読み込み中...';
  const answerIsCorrect = Boolean(answer && currentQuiz && answer === currentQuiz.correct);
  const feedbackTitle = answerIsCorrect ? '正解！' : 'もう一度確認しよう';
  const feedbackText = answerIsCorrect
    ? 'よくできました。この調子で次の問題へ進もう。'
    : `正しい答えは「${currentQuiz?.correct || '-'}」です。カードで意味と例文を確認できます。`;
  const choiceLetters = ['A', 'B', 'C', 'D'];
  const quizWord = currentQuiz?.word || currentQuiz?.correct || targetJapanese;
  const quizQuestionText = currentQuiz?.word
    ? `${currentQuiz.word} の意味はどれ？`
    : `${targetJapanese} はどれ？`;

  return (
    <>
    <div className="quest-quiz-page-wrap lg:hidden">
      <EQMobileShell className="eq-quiz-screen">
        <QuestHeader
          title="小テスト"
          subtitle="ことばをおぼえたか ためしてみよう"
          backTo="/flashcard"
          className="quest-quiz-header"
        />
        <QuestProgressStepper current="quiz" completed={['words']} />
        <SpiritGuide
          worldName="風の精霊"
          messages={['つぎはクイズだよ！\nがんばろう！', '答えを選んだら、理由も見てみよう！']}
          className="quest-quiz-spirit"
        />

        {error ? (
          <EQCard className="eq-quiz-state-card">
            <h1>読み込みに失敗しました</h1>
            <p>{error}</p>
          </EQCard>
        ) : isInitialLoading ? (
          <EQCard className="eq-quiz-state-card">
            <h1>クイズを準備中...</h1>
            <p>復習できる単語を集めています。</p>
          </EQCard>
        ) : isBatchComplete ? (
          <EQCard className="eq-quiz-state-card">
            <span className="eq-quiz-type-badge">結果</span>
            <h1>{correctCount} / {questions.length} 正解</h1>
            <p>{wrongAnswers.length > 0 ? 'まちがえた問題をもう一度練習できます。' : '全問正解です。よくできました！'}</p>
            <div className="eq-quiz-result-actions">
              {wrongAnswers.length === 0 && (
                <button type="button" onClick={() => navigate('/grammar')} className="eq-gold-button">
                  文法学習へ
                </button>
              )}
              {wrongAnswers.length > 0 && (
                <button type="button" onClick={() => fetchQuizBatch({ retryWrong: true })} className="eq-purple-button">
                  まちがい練習
                </button>
              )}
              {wrongAnswers.length > 0 && (
              <button type="button" onClick={() => fetchQuizBatch()} className="eq-gold-button">
                次の10問
              </button>
              )}
            </div>
          </EQCard>
        ) : hasNoReviewWords ? (
          <EQCard className="eq-quiz-state-card">
            <h1>クイズできる単語がありません</h1>
            <p>{emptyMessage || '単語カードで単語を覚えてから、もう一度ためしましょう。'}</p>
            <button type="button" onClick={openCard} className="eq-gold-button">
              単語カードへ
            </button>
          </EQCard>
        ) : (
          <>
            <MagicPanel
              className={`quest-quiz-panel ${answer ? (answerIsCorrect ? 'is-correct' : 'is-wrong') : ''}`.trim()}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="quest-quiz-panel-top">
                <span>✦ {mobileQuestionCount}</span>
                <strong>正解 <b>{correctCount}</b></strong>
              </div>

              <h1 className="quest-quiz-question">{quizQuestionText}</h1>

              <div className="quest-quiz-audio-row">
                <AudioButton onClick={() => speak(quizWord)}>
                  単語を聞く
                </AudioButton>
                <AudioButton
                  tone="purple"
                  onClick={() => speak(currentQuiz?.example || quizWord)}
                >
                  例文を聞く
                </AudioButton>
              </div>

              <div className="eq-quiz-options quest-quiz-options">
                {currentQuiz?.choices.map((choice, index) => {
                  const isCorrect = answer && choice === currentQuiz.correct;
                  const isWrong = answer && choice === answer && choice !== currentQuiz.correct;
                  return (
                    <EQChoiceButton
                      key={choice}
                      badge={choiceLetters[index] || String(index + 1)}
                      correct={Boolean(isCorrect)}
                      wrong={Boolean(isWrong)}
                      selected={answer === choice && !isWrong && !isCorrect}
                      onClick={() => handleSelection(choice)}
                      disabled={!!answer || submittingAnswer}
                      className="quest-quiz-choice"
                    >
                      {choice}
                    </EQChoiceButton>
                  );
                })}
              </div>

              {answer && currentQuiz ? (
                <div className={`quest-quiz-feedback ${answerIsCorrect ? 'is-correct' : 'is-wrong'}`}>
                  <h2>{feedbackTitle}</h2>
                  <p>{feedbackText}</p>
                  {result?.pet_exp_awarded > 0 ? <p className="eq-quiz-exp">EXP +{result.pet_exp_awarded}</p> : null}
                </div>
              ) : null}

              <GoldQuestButton
                onClick={answer ? handleNext : undefined}
                disabled={!answer || submittingAnswer || !result}
                className="quest-quiz-submit"
              >
                {submittingAnswer ? '判定中...' : answer ? (currentIndex >= questions.length - 1 ? '結果を見る' : 'つぎへ') : 'こたえる'}
              </GoldQuestButton>
            </MagicPanel>
          </>
        )}
      </EQMobileShell>
      <EQBottomNav
        items={[
          { label: 'ホーム', to: '/app', icon: 'home' },
          { label: '地図', to: '/study-map', icon: 'map' },
          { label: '学習', to: '/daily-words', icon: 'study', active: true },
          { label: 'カード', to: '/flashcard', icon: 'cards' },
          { label: 'その他', to: '/settings', icon: 'more' },
        ]}
      />
    </div>
    <div className="hidden lg:block">
    <WebLearningLayout title="三択練習" subtitle="覚えた単語をクイズで確認" rightPanel={rightPanel}>

      {error ? (
        <div className="panel px-5 py-5 text-sm text-rose-700">{error}</div>
      ) : (
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="panel px-6 py-6 sm:px-8">
          <div className="rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#e0f2ff_100%)] p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/82 px-4 py-2 text-xs font-black text-[#6176aa]">
                覚えた単語 {masteredCount}
              </span>
              <span className="rounded-full bg-[#fff2bb] px-4 py-2 text-xs font-black text-[#69557e]">
                まちがい {errorCount}
              </span>
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#6f7da8]">例文4択クイズ</p>
            <h2 className="display-font mt-4 text-3xl font-extrabold leading-tight text-[#354172] sm:text-4xl">
              {isInitialLoading
                ? '復習できる単語を確認しています...'
                : isBatchComplete
                  ? `できました！ ${correctCount} / ${questions.length} 正解`
                  : hasNoReviewWords
                  ? emptyMessage || 'まだ復習できる単語がありません。まず単語カードで覚えましょう。'
                  : currentQuiz?.question || '問題を読み込み中...'}
            </h2>
            <p className="mt-3 text-sm font-bold leading-6 text-[#6f7da8]">
              ランダムに最大10問出します。同じセットの中では同じ単語を出しません。
            </p>
          </div>

          {isInitialLoading ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-5 text-center text-sm font-bold leading-7 text-[#60709d]">
              少し待ってね。復習リストを作っています。
            </div>
          ) : isBatchComplete ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-5 text-sm font-bold leading-7 text-[#60709d]">
              <p className="text-lg font-black text-[#354172]">結果: {correctCount} / {questions.length}</p>
              {wrongAnswers.length > 0 ? (
                <p className="mt-2">まちがえた問題は、もう一度練習できます。</p>
              ) : (
                <p className="mt-2">全問正解です。よくできました！</p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                {wrongAnswers.length > 0 && (
                  <button type="button" onClick={() => fetchQuizBatch({ retryWrong: true })} className="ghost-button px-5 py-3">
                    まちがいを練習
                  </button>
                )}
                <button type="button" onClick={() => fetchQuizBatch()} className="pill-button px-5 py-3">
                  別の10問に挑戦
                </button>
              </div>
            </div>
          ) : hasNoReviewWords ? (
            <div className="mt-6 rounded-[24px] bg-white/78 p-5 text-center text-sm font-bold leading-7 text-[#60709d]">
              {emptyMessage || 'まだ復習できる単語がありません。単語カードで単語を覚えてから、もう一度ためしましょう。'}
              <div className="mt-4">
                <button type="button" onClick={openCard} className="pill-button px-6 py-3">
                  単語カードへ
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4">
                {currentQuiz?.choices.map((choice) => {
                  const isCorrect = answer && choice === currentQuiz.correct;
                  const isWrong = answer && choice === answer && choice !== currentQuiz.correct;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => handleSelection(choice)}
                      disabled={!!answer || submittingAnswer}
                      className={`rounded-[24px] border px-5 py-4 text-left text-lg font-bold transition ${
                        isCorrect
                          ? 'border-[#ffcf48] bg-[#fff4bf] text-[#5e4e76]'
                          : isWrong
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-white/80 bg-white/78 text-[#34406f] hover:bg-[#f6fbff]'
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              {answer && currentQuiz && (
                <div className="mt-5 rounded-[24px] bg-[#f9fcff] p-5 text-sm leading-7 text-[#60709d]">
                  <p className="text-base font-black text-[#354172]">
                    {answer === currentQuiz.correct ? 'せいかい！' : `こたえ: ${currentQuiz.correct}`}
                  </p>
                  {currentQuiz.word && <div className="mt-3"><TtsButton text={currentQuiz.word} label="単語" /></div>}
                  {currentQuiz.japanese && <p className="mt-2">意味: {currentQuiz.japanese}</p>}
                  {currentQuiz.example && (
                    <div className="mt-2">
                      <p>使い方: {currentQuiz.example}</p>
                      <div className="mt-2"><TtsButton text={currentQuiz.example} label="例文" /></div>
                    </div>
                  )}
                  {currentQuiz.example_jp && <p className="mt-2">例文の意味: {currentQuiz.example_jp}</p>}
                  {result?.pet_exp_awarded > 0 && (
                    <p className="mt-2 font-bold text-[#6b5a2d]">ポケモン EXP +{result.pet_exp_awarded}</p>
                  )}
                  {answer !== currentQuiz.correct && (
                    <button type="button" onClick={openCard} className="ghost-button mt-4 px-5 py-3">
                      カードで意味・使い方・発音を見る
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0 || loading}
              className="ghost-button px-5 py-3 disabled:opacity-40"
            >
              前へ
            </button>
            <div className="text-sm font-bold text-[#7280a8]">{pageText}</div>
            <button
              type="button"
              onClick={handleNext}
              disabled={loading || submittingAnswer || !currentQuiz?.correct || !answer || !result}
              className="pill-button px-5 py-3 disabled:opacity-40"
            >
              {loading || submittingAnswer ? '読み込み中...' : currentIndex >= questions.length - 1 ? '結果を見る' : '次の問題'}
            </button>
          </div>
        </motion.section>
      )}
    </WebLearningLayout>
    </div>
    </>
  );
}
