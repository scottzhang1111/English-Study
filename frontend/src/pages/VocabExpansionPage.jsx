import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import { getVocabExpansionQuestion, submitVocabExpansionAnswer } from '../api';

const MODES = [
  { value: 'synonym', label: 'Synonym' },
  { value: 'antonym', label: 'Antonym' },
];

export default function VocabExpansionPage() {
  const [mode, setMode] = useState('synonym');
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadQuestion = async (nextMode = mode) => {
    setLoading(true);
    setError('');
    try {
      const payload = await getVocabExpansionQuestion(nextMode);
      setQuestion(payload);
      setAnswer('');
      setResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestion(mode);
  }, []);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    loadQuestion(nextMode);
  };

  const handleAnswer = async (choice) => {
    if (!question || answer) return;
    setAnswer(choice);
    try {
      const payload = await submitVocabExpansionAnswer({
        id: question.id,
        selected: choice,
        correct: question.correct,
        childId: localStorage.getItem('selected_child_id') || '',
      });
      setResult(payload);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="Synonym and antonym practice" />

      {error ? (
        <div className="panel px-5 py-5 text-sm text-rose-700">{error}</div>
      ) : (
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="panel px-6 py-6 sm:px-8">
          <div className="flex flex-wrap gap-2">
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => handleModeChange(item.value)}
                disabled={loading}
                className={`rounded-full px-5 py-2 text-sm font-black transition ${
                  mode === item.value ? 'bg-[#ffe66b] text-[#5f4a00]' : 'bg-white/78 text-[#6176aa]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-[30px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#6f7da8]">
              {question?.mode === 'antonym' ? 'Antonym' : 'Synonym'}
            </p>
            <h2 className="display-font mt-4 text-3xl font-extrabold leading-tight text-[#354172] sm:text-4xl">
              {loading ? 'Loading...' : question?.question || 'Vocabulary expansion'}
            </h2>
            {question?.japanese && <p className="mt-3 text-base font-bold text-[#60709d]">{question.japanese}</p>}
            {question?.phrase && <p className="mt-2 text-sm font-bold text-[#6b5a2d]">{question.phrase}</p>}
          </div>

          <div className="mt-6 grid gap-4">
            {(question?.choices || []).map((choice) => {
              const isCorrect = answer && choice === question.correct;
              const isWrong = answer && choice === answer && choice !== question.correct;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => handleAnswer(choice)}
                  disabled={!!answer || loading}
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

          {answer && question && (
            <div className="mt-5 rounded-[24px] bg-[#f9fcff] p-5 text-sm leading-7 text-[#60709d]">
              <p className="text-base font-black text-[#354172]">
                {answer === question.correct ? 'Correct!' : `Correct answer: ${question.correct}`}
              </p>
              {question.synonyms?.length > 0 && <p className="mt-2">Synonyms: {question.synonyms.join(', ')}</p>}
              {question.synonyms_japanese && <p className="mt-1">Synonyms JA: {question.synonyms_japanese}</p>}
              {question.antonyms?.length > 0 && <p className="mt-2">Antonyms: {question.antonyms.join(', ')}</p>}
              {question.antonyms_japanese && <p className="mt-1">Antonyms JA: {question.antonyms_japanese}</p>}
              {question.example && <p className="mt-2">Example: {question.example}</p>}
              {question.example_jp && <p className="mt-1">Example JA: {question.example_jp}</p>}
              {result?.pet_exp_awarded > 0 && (
                <p className="mt-2 font-bold text-[#6b5a2d]">Pokemon EXP +{result.pet_exp_awarded}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button type="button" onClick={() => loadQuestion()} disabled={loading} className="pill-button px-5 py-3 disabled:opacity-40">
              {loading ? 'Loading...' : 'Next'}
            </button>
          </div>
        </motion.section>
      )}
    </div>
  );
}
