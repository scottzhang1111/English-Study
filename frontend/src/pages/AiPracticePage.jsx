import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import PetDisplay from '../components/PetDisplay';
import { getAiPracticeQuestion, submitAiPracticeAnswer } from '../api';

const typeLabels = {
  multiple_choice: 'Choice',
  fill_blank: 'Blank',
  en_to_ja: 'EN to JP',
  ja_to_en: 'JP to EN',
  sentence: 'Sentence',
  reading: 'Reading',
  writing: 'Writing',
};

export default function AiPracticePage() {
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  const childId = localStorage.getItem('selected_child_id') || '';
  const needsTextAnswer = question && ['sentence', 'writing'].includes(question.type);
  const displayQuestion = question?.question || question?.prompt || '';
  const correctAnswer = result?.answer || result?.correct_answer || '';

  const loadQuestion = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswer('');
    setPet(null);
    try {
      const payload = await getAiPracticeQuestion(childId);
      setQuestion(payload.question);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestion();
  }, []);

  const submitAnswer = async (selectedAnswer) => {
    if (!question || checking || result) return;
    const finalAnswer = selectedAnswer ?? answer;
    if (!finalAnswer.trim()) return;
    setChecking(true);
    setAnswer(finalAnswer);
    try {
      const payload = await submitAiPracticeAnswer({
        childId,
        questionId: question.question_id,
        selectedAnswer: finalAnswer,
      });
      setResult(payload);
      setPet(payload.pet || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="Local Practice" />

      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="panel overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#6f7da8]">Local rule-based quiz</p>
            <h1 className="display-font mt-1 text-3xl font-black text-[#354172]">Practice</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#fff1a8] px-4 py-2 text-sm font-black text-[#6b5600]">
              Combo {result?.combo ?? question?.combo ?? 0}
            </span>
            <span className="rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-black text-[#25734b]">
              Mastery {result?.mastery ?? 0}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] bg-[#fff8d9] px-4 py-3 text-sm font-bold leading-6 text-[#75622c]">
          Questions are generated locally from the vocabulary database.
        </div>

        {loading ? (
          <div className="mt-6 rounded-[28px] bg-white/78 p-8 text-center text-lg font-black text-[#6f7da8]">
            Loading question...
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[28px] bg-rose-50 p-6 text-center font-bold text-rose-700">
            {error}
          </div>
        ) : question ? (
          <>
            <div className="mt-5 rounded-[30px] bg-[linear-gradient(180deg,#e8f8ff_0%,#f7fcff_100%)] p-5 sm:p-7">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#ffd253] px-4 py-2 text-sm font-black text-[#5d4d77]">
                  {typeLabels[question.type] || question.type}
                </span>
                <span className="rounded-full bg-white/88 px-4 py-2 text-sm font-black text-[#6176aa]">
                  Local
                </span>
              </div>
              <p className="whitespace-pre-line text-2xl font-black leading-10 text-[#2f3d69]">
                {displayQuestion}
              </p>
            </div>

            {needsTextAnswer ? (
              <div className="mt-5 space-y-3">
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={!!result}
                  rows={4}
                  className="w-full rounded-[26px] border-2 border-white/80 bg-white/88 p-5 text-xl font-bold leading-8 text-[#354172] outline-none focus:border-[#ffd253]"
                  placeholder="Write your answer"
                />
                <button
                  type="button"
                  onClick={() => submitAnswer()}
                  disabled={checking || !!result || !answer.trim()}
                  className="pill-button w-full px-6 py-5 text-xl disabled:opacity-50"
                >
                  Check
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {question.choices.map((choice) => {
                  const isPicked = answer === choice;
                  const isCorrect = result && choice === correctAnswer;
                  const isWrong = result && isPicked && !isCorrect;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => submitAnswer(choice)}
                      disabled={checking || !!result}
                      className={`min-h-[76px] rounded-[26px] border-2 px-5 py-4 text-left text-xl font-black transition ${
                        isCorrect
                          ? 'border-[#ffd253] bg-[#fff4bf] text-[#5d4d77]'
                          : isWrong
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-white/80 bg-white/86 text-[#34406f] hover:-translate-y-0.5 hover:bg-[#f6fbff]'
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}

            {result && (
              <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-5 rounded-[28px] bg-white/80 p-5">
                <p className={`text-2xl font-black ${result.correct ? 'text-[#25734b]' : 'text-[#c2415d]'}`}>
                  {result.correct ? 'Correct! +XP' : 'Nice try. Keep going!'}
                </p>
                <p className="mt-2 text-lg font-bold leading-8 text-[#5f6f9a]">
                  Answer: {correctAnswer}
                </p>
                {pet && (
                  <div className="mt-4">
                    <PetDisplay pet={pet} earnedExp={result.xp_awarded} compact />
                  </div>
                )}
              </motion.div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button type="button" onClick={loadQuestion} className="pill-button px-6 py-4 text-lg">
                Next
              </button>
              <div className="rounded-full bg-white/78 px-5 py-4 text-center text-sm font-black text-[#6f7da8]">
                {question.word} / {question.meaning}
              </div>
            </div>
          </>
        ) : null}
      </motion.section>
    </div>
  );
}
