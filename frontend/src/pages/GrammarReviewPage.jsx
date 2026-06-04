import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useChildren } from '../ChildrenContext';
import {
  EQBadge,
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
  EQQuestCard,
} from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import { getGrammarQuizWrongQuestions, submitGrammarQuizAnswer } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

export default function GrammarReviewPage() {
  const { selectedChildId: currentChildId } = useChildren();
  const childId = currentChildId || localStorage.getItem(CHILD_STORAGE_KEY) || '';
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadWrongQuestions = async () => {
    if (!childId) {
      setWrongQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await getGrammarQuizWrongQuestions(childId);
      setWrongQuestions(payload.wrongQuestions || payload.wrong_questions || []);
    } catch (err) {
      setError(err.message || '文法の復習リストを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWrongQuestions();
  }, [childId]);

  const openQuestion = (question) => {
    setActiveQuestion(question);
    setSelectedIndex(null);
    setAnswerResult(null);
    setError('');
  };

  const closeQuestion = () => {
    setActiveQuestion(null);
    setSelectedIndex(null);
    setAnswerResult(null);
  };

  const handleAnswer = async (choiceIndex) => {
    if (!activeQuestion || submitting || answerResult) return;
    setSelectedIndex(choiceIndex);
    setSubmitting(true);
    setError('');
    try {
      const payload = await submitGrammarQuizAnswer({
        childId,
        quizId: activeQuestion.quizId,
        selectedIndex: choiceIndex,
      });
      setAnswerResult(payload);
      if (payload.isCorrect) {
        await loadWrongQuestions();
      }
    } catch (err) {
      setError(err.message || '回答を保存できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  const unresolvedCount = wrongQuestions.length;
  const currentChoices = useMemo(() => activeQuestion?.choices || [], [activeQuestion]);

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <CompactPageHeader
          title="文法の復習"
          subtitle="最新の答えがまちがいの問題だけを復習"
          backgroundImage="/assets/eigo-quest/learning-hub/譁・ｳ輔・逾樊ｮｿ.png"
          elementLabel="文法"
          progressText={loading ? '確認中' : `${unresolvedCount} 問`}
          helperImage="/assets/eigo-quest/spirit_assets/happy.png"
          variant="grammar"
        />
        <EQPageHeader
          eyebrow="Grammar Review"
          title="文法のまちがい"
          subtitle="答え直して、正解した問題からクリアしよう"
          icon="G"
        />

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <EQPrimaryButton as={Link} to="/review">
              復習メニューへ
            </EQPrimaryButton>
            <EQBadge tone="green">{loading ? '確認中' : `${unresolvedCount} 問`}</EQBadge>
          </div>

          {error ? (
            <EQPanel title="エラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : null}

          {loading ? (
            <EQPanel tone="cyan">
              <p className="eq-caption text-center">文法のまちがいを確認中...</p>
            </EQPanel>
          ) : activeQuestion ? (
            <EQPanel title={activeQuestion.lessonTitle || '文法問題'} tone="green">
              <div className="flex flex-wrap gap-2">
                <EQBadge tone="green">{activeQuestion.category || '文法'}</EQBadge>
                <EQBadge tone="amber">前回: {activeQuestion.selectedAnswer || '未回答'}</EQBadge>
              </div>
              <p className="eq-caption text-lg font-black">{activeQuestion.questionJp}</p>
              <div className="grid gap-3">
                {currentChoices.map((choice, choiceIndex) => {
                  const isChosen = selectedIndex === choiceIndex;
                  const isCorrect = answerResult && choiceIndex === Number(answerResult.correctIndex);
                  const isWrong = answerResult && isChosen && !answerResult.isCorrect;
                  return (
                    <button
                      key={`${activeQuestion.quizId}-${choiceIndex}`}
                      type="button"
                      onClick={() => handleAnswer(choiceIndex)}
                      disabled={submitting || Boolean(answerResult)}
                      className={`eq-choice-button eq-fantasy-choice-button ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}`}
                    >
                      <span className="eq-choice-label">{String.fromCharCode(65 + choiceIndex)}</span>
                      <span className="eq-choice-text">{choice}</span>
                    </button>
                  );
                })}
              </div>
              {answerResult ? (
                <EQPanel tone={answerResult.isCorrect ? 'green' : 'rose'}>
                  <p className="eq-caption text-base font-black">
                    {answerResult.isCorrect ? '正解！この問題は復習リストから外れます。' : 'もう一度確認しよう。'}
                  </p>
                  <p className="eq-caption">{answerResult.explanationJp || activeQuestion.explanationJp}</p>
                  <div className="grid gap-3">
                    {answerResult.isCorrect ? (
                      <EQPrimaryButton type="button" onClick={closeQuestion} fullWidth>
                        一覧へ戻る
                      </EQPrimaryButton>
                    ) : (
                      <EQPrimaryButton type="button" onClick={() => openQuestion(activeQuestion)} fullWidth>
                        もう一度
                      </EQPrimaryButton>
                    )}
                  </div>
                </EQPanel>
              ) : null}
            </EQPanel>
          ) : unresolvedCount === 0 ? (
            <EQPanel title="文法のまちがいはありません" tone="green">
              <p className="eq-caption">最新の回答がまちがいの文法問題はありません。</p>
              <EQPrimaryButton as={Link} to="/grammar" fullWidth>
                文法の神殿へ
              </EQPrimaryButton>
            </EQPanel>
          ) : (
            <div className="grid gap-4">
              {wrongQuestions.map((item) => (
                <EQQuestCard
                  key={item.quizId}
                  tone="green"
                  icon="G"
                  title={item.lessonTitle || item.category || '文法問題'}
                  subtitle={item.questionJp}
                  meta={`正解: ${item.correctAnswer}`}
                  badges={
                    <div className="flex flex-wrap gap-2">
                      <EQBadge tone="green">{item.category || '文法'}</EQBadge>
                      <EQBadge tone="amber">前回: {item.selectedAnswer || '未回答'}</EQBadge>
                    </div>
                  }
                  action={
                    <EQPrimaryButton type="button" onClick={() => openQuestion(item)}>
                      やり直す
                    </EQPrimaryButton>
                  }
                />
              ))}
            </div>
          )}
        </motion.section>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
