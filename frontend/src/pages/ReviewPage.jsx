import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import TtsButton from '../components/TtsButton';
import {
  EQBadge,
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
  EQQuestCard,
} from '../components/eigo';
import {
  getBattleWrongQuestions,
  getEikenPre2WrongQuestions,
  getGrammarFormWrongQuestions,
  getReviewList,
  masterBattleWrongQuestion,
  masterGrammarFormWrongQuestion,
  submitPracticeAnswer,
} from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function ReviewStats({ reviewList, battleWrongList, grammarFormWrongList, eikenWrongList }) {
  const totalReviewCount = reviewList.length + battleWrongList.length + grammarFormWrongList.length + eikenWrongList.length;

  return (
    <EQPanel title={`${totalReviewCount} 件`} eyebrow="Review Status" tone="gold">
      <div className="grid grid-cols-2 gap-2 text-sm font-black text-[var(--eq-text-sub)]">
        <EQBadge tone="cyan">単語 {reviewList.length}</EQBadge>
        <EQBadge tone="purple">バトル {battleWrongList.length}</EQBadge>
        <EQBadge tone="green">文法 {grammarFormWrongList.length}</EQBadge>
        <EQBadge tone="amber">英検 {eikenWrongList.length}</EQBadge>
      </div>
      <EQPrimaryButton as={Link} to="/flashcard" fullWidth>
        単語を学ぶ
      </EQPrimaryButton>
    </EQPanel>
  );
}

function ReviewSection({ title, subtitle, tone = 'gold', children }) {
  return (
    <EQPanel title={title} tone={tone}>
      {subtitle ? <p className="eq-caption">{subtitle}</p> : null}
      <div className="grid gap-3">{children}</div>
    </EQPanel>
  );
}

export default function ReviewPage() {
  const [reviewList, setReviewList] = useState([]);
  const [battleWrongList, setBattleWrongList] = useState([]);
  const [grammarFormWrongList, setGrammarFormWrongList] = useState([]);
  const [eikenWrongList, setEikenWrongList] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem(CHILD_STORAGE_KEY) || '');
  const [selectedWord, setSelectedWord] = useState(null);
  const [stage, setStage] = useState('list');
  const [quiz, setQuiz] = useState(null);
  const [answer, setAnswer] = useState('');
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const totalReviewCount = reviewList.length + battleWrongList.length + grammarFormWrongList.length + eikenWrongList.length;

  useEffect(() => {
    const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
    setSelectedChildId(childId);
    setLoading(true);
    Promise.allSettled([
      getReviewList(childId),
      getBattleWrongQuestions(childId),
      getGrammarFormWrongQuestions(childId),
      getEikenPre2WrongQuestions({ childId, latestOnly: true, limit: 6 }),
    ])
      .then(([reviewResult, battleResult, grammarFormResult, eikenResult]) => {
        const failed = [reviewResult, battleResult, grammarFormResult, eikenResult].filter((result) => result.status === 'rejected');

        setReviewList(reviewResult.status === 'fulfilled' ? reviewResult.value.review_list || [] : []);
        setBattleWrongList(battleResult.status === 'fulfilled' ? battleResult.value.wrongQuestions || [] : []);
        setGrammarFormWrongList(grammarFormResult.status === 'fulfilled' ? grammarFormResult.value.wrongQuestions || [] : []);
        setEikenWrongList(eikenResult.status === 'fulfilled' ? eikenResult.value.wrong_questions || [] : []);

        if (failed.length === 4) {
          throw new Error(failed[0].reason?.message || '復習リストを読み込めませんでした。');
        }
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleMasterBattleWrong = (wrongId) => {
    masterBattleWrongQuestion(wrongId)
      .then(() => setBattleWrongList((items) => items.filter((item) => item.wrongId !== wrongId)))
      .catch((err) => setError(err.message));
  };

  const handleMasterGrammarFormWrong = (testId) => {
    const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';
    masterGrammarFormWrongQuestion({ childId, testId })
      .then(() => setGrammarFormWrongList((items) => items.filter((item) => item.testId !== testId)))
      .catch((err) => setError(err.message));
  };

  const buildWrongWordQuiz = (wordItem) => {
    const distractors = reviewList
      .filter((item) => String(item.word_id) !== String(wordItem.word_id))
      .map((item) => item.word)
      .filter(Boolean)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const choices = [wordItem.word, ...distractors].sort(() => Math.random() - 0.5);
    return {
      id: wordItem.word_id || wordItem.id,
      word: wordItem.word,
      correct: wordItem.word,
      choices,
      question: wordItem.example
        ? wordItem.example.replace(new RegExp(`\\b${String(wordItem.word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '____')
        : `「${wordItem.japanese}」の英語はどれ？`,
    };
  };

  const openReviewWord = (item) => {
    setSelectedWord(item);
    setQuiz(null);
    setAnswer('');
    setQuizResult(null);
    setStage('detail');
  };

  const startWrongQuiz = () => {
    if (!selectedWord) return;
    setQuiz(buildWrongWordQuiz(selectedWord));
    setAnswer('');
    setQuizResult(null);
    setStage('quiz');
  };

  const handleQuizAnswer = async (choice) => {
    if (!quiz || answer) return;
    setAnswer(choice);
    try {
      const payload = await submitPracticeAnswer({
        id: selectedWord.word_id || selectedWord.id,
        word: selectedWord.word,
        selected: choice,
        correct: quiz.correct,
        childId: localStorage.getItem(CHILD_STORAGE_KEY) || '',
      });
      setQuizResult(payload);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <EQPageHeader
          eyebrow="Wrong Review"
          title="まちがい直し"
          subtitle="苦手な問題をもう一度クリアしよう"
          icon="!"
        />

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <ReviewStats
            reviewList={reviewList}
            battleWrongList={battleWrongList}
            grammarFormWrongList={grammarFormWrongList}
            eikenWrongList={eikenWrongList}
          />

          {loading ? (
            <EQPanel tone="cyan">
              <p className="eq-caption text-center">復習リストを読み込み中...</p>
            </EQPanel>
          ) : error ? (
            <EQPanel title="読み込みエラー" tone="rose">
              <p className="eq-caption">{error}</p>
            </EQPanel>
          ) : totalReviewCount === 0 ? (
            <EQPanel title="復習する問題はありません" tone="green">
              <p className="eq-caption">よくできました！次のクエストへ進みましょう。</p>
              <div className="flex flex-wrap gap-3">
                <EQPrimaryButton as={Link} to="/" fullWidth>
                  ホームへ
                </EQPrimaryButton>
                <EQPrimaryButton as={Link} to="/flashcard" fullWidth>
                  単語を学ぶ
                </EQPrimaryButton>
              </div>
            </EQPanel>
          ) : stage === 'detail' && selectedWord ? (
            <EQPanel title={selectedWord.word} tone="gold">
              <div className="flex flex-wrap items-center gap-2">
                <TtsButton text={selectedWord.word} label="単語" />
                <EQBadge tone="amber">まちがい {selectedWord.error_count}</EQBadge>
              </div>
              <p className="eq-caption text-lg font-black">{selectedWord.japanese}</p>
              {selectedWord.example && (
                <EQPanel tone="cyan">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="eq-caption">例文: {selectedWord.example}</p>
                    <TtsButton text={selectedWord.example} label="例文" />
                  </div>
                </EQPanel>
              )}
              {(selectedWord.example_japanese || selectedWord.sentence_jp) && (
                <EQPanel tone="purple">
                  <p className="eq-caption">意味: {selectedWord.example_japanese || selectedWord.sentence_jp}</p>
                </EQPanel>
              )}
              <div className="grid gap-3">
                <EQPrimaryButton type="button" onClick={startWrongQuiz} fullWidth>
                  この問題をやり直す
                </EQPrimaryButton>
                <EQPrimaryButton as="button" type="button" onClick={() => setStage('list')} fullWidth>
                  一覧へ戻る
                </EQPrimaryButton>
              </div>
            </EQPanel>
          ) : stage === 'quiz' && selectedWord && quiz ? (
            <EQPanel title="まちがい直し" tone="gold">
              <p className="eq-caption text-lg font-black">{quiz.question}</p>
              {quiz.choices.length < 2 ? (
                <EQPanel tone="rose">
                  <p className="eq-caption">選択肢を作るには、まちがえた単語がもう少し必要です。</p>
                </EQPanel>
              ) : (
                <div className="grid gap-3">
                  {quiz.choices.map((choice) => {
                    const isCorrect = answer && choice === quiz.correct;
                    const isWrong = answer === choice && choice !== quiz.correct;
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => handleQuizAnswer(choice)}
                        disabled={!!answer}
                        className={`eq-choice-button eq-fantasy-choice-button ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}`}
                      >
                        <span className="eq-choice-text">{choice}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {answer && (
                <EQPanel tone={answer === quiz.correct ? 'green' : 'rose'}>
                  <p className="eq-caption text-base font-black">
                    {answer === quiz.correct ? 'せいかい！' : `こたえ: ${quiz.correct}`}
                  </p>
                  {quizResult?.pet_exp_awarded > 0 && <EQBadge tone="gold">EXP +{quizResult.pet_exp_awarded}</EQBadge>}
                  <div className="grid gap-3">
                    <EQPrimaryButton type="button" onClick={startWrongQuiz} fullWidth>
                      もう一度
                    </EQPrimaryButton>
                    <EQPrimaryButton type="button" onClick={() => setStage('list')} fullWidth>
                      一覧へ戻る
                    </EQPrimaryButton>
                  </div>
                </EQPanel>
              )}
            </EQPanel>
          ) : (
            <div className="grid gap-4">
              <ReviewSection
                title="単語のまちがい"
                subtitle="まちがえた単語を選んで、もう一度学習してから問題をやり直しましょう。"
                tone="gold"
              >
                {reviewList.map((item) => (
                  <EQQuestCard
                    key={item.word_id}
                    as="article"
                    tone="gold"
                    icon="単"
                    title={item.word}
                    subtitle={item.japanese}
                    badges={<EQBadge tone="amber">まちがい {item.error_count}</EQBadge>}
                    action={
                      <div className="flex flex-wrap gap-2">
                        <TtsButton text={item.word} label="Word" />
                        <EQPrimaryButton type="button" onClick={() => openReviewWord(item)}>
                          開く
                        </EQPrimaryButton>
                      </div>
                    }
                  />
                ))}
              </ReviewSection>

              {battleWrongList.length > 0 && (
                <ReviewSection title="文法バトルのまちがい" subtitle="確認できたらクリア済みにできます。" tone="purple">
                  {battleWrongList.map((item) => (
                    <EQQuestCard
                      key={item.wrongId}
                      tone="purple"
                      icon="文"
                      title={item.category}
                      subtitle={item.questionText}
                      meta={`正解: ${item.correctAnswer}`}
                      action={
                        <EQPrimaryButton type="button" onClick={() => handleMasterBattleWrong(item.wrongId)}>
                          できた！
                        </EQPrimaryButton>
                      }
                    >
                      <p className="eq-caption">{item.explanation || '解説はまだ準備中です。'}</p>
                    </EQQuestCard>
                  ))}
                </ReviewSection>
              )}

              {grammarFormWrongList.length > 0 && (
                <ReviewSection title="文法練習のまちがい" subtitle="練習で間違えた文法問題です。" tone="green">
                  {grammarFormWrongList.map((item) => (
                    <EQQuestCard
                      key={item.testId}
                      tone="green"
                      icon="G"
                      title={`${item.category} / ${item.title}`}
                      subtitle={item.questionJp}
                      meta={`答え: ${item.correctAnswer}`}
                      action={
                        <EQPrimaryButton type="button" onClick={() => handleMasterGrammarFormWrong(item.testId)}>
                          できた！
                        </EQPrimaryButton>
                      }
                    >
                      <p className="eq-caption">{item.promptEn}</p>
                      <p className="eq-caption">{item.correctReasonJp}</p>
                    </EQQuestCard>
                  ))}
                </ReviewSection>
              )}

              {eikenWrongList.length > 0 && (
                <ReviewSection title="英検チャレンジのまちがい" subtitle="模試で間違えた問題を英検復習へ送ります。" tone="amber">
                  <EQPrimaryButton
                    as={Link}
                    to={`/eiken-pre2/wrong-review?student_id=${encodeURIComponent(selectedChildId)}`}
                    fullWidth
                  >
                    英検問題を練習
                  </EQPrimaryButton>
                  {eikenWrongList.slice(0, 3).map((item) => (
                    <EQQuestCard
                      key={item.question_id}
                      tone="amber"
                      icon="E"
                      title={item.question_type || item.section || '問題'}
                      subtitle={item.question_text || item.prompt}
                      meta={`正解: ${item.correct_option || ''}`}
                      badges={item.weak_point_tag ? <EQBadge tone="rose">{item.weak_point_tag}</EQBadge> : null}
                    />
                  ))}
                  {eikenWrongList.length > 3 && (
                    <EQBadge tone="amber">ほか {eikenWrongList.length - 3} 問</EQBadge>
                  )}
                </ReviewSection>
              )}
            </div>
          )}
        </motion.section>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
