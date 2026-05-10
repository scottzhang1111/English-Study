import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useParams } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import { getEikenPre2Attempt } from '../api';

const TYPE_LABELS = {
  sentence_fill: '短句填空',
  dialogue_completion: '対話完成',
  reading: '読解',
};

export default function EikenPre2ResultPage() {
  const { attemptId } = useParams();
  const location = useLocation();
  const [result, setResult] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(!location.state?.result);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (result || !attemptId) return;
    setLoading(true);
    getEikenPre2Attempt(attemptId)
      .then(setResult)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [attemptId, result]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="チャレンジ結果" />

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel px-5 py-5 sm:px-7">
        {loading ? (
          <div className="rounded-[24px] bg-white/76 p-6 text-center font-bold text-[#6f7da8]">結果を読み込み中...</div>
        ) : error ? (
          <div className="rounded-[24px] bg-rose-50 p-6 text-sm font-bold text-rose-700">{error}</div>
        ) : result ? (
          <>
            <div className="rounded-[28px] bg-[linear-gradient(180deg,#fff8d9_0%,#eef8ff_100%)] p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7d8db5]">{result.set_id}</p>
              <h2 className="display-font mt-2 text-3xl font-extrabold text-[#354172]">
                {result.correct_count} / {result.total_questions} 問せいかい
              </h2>
              <p className="mt-2 text-lg font-black text-[#6b5a2d]">正答率 {result.score_percent}%</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(result.type_stats || []).map((stat) => (
                <div key={stat.question_type} className="rounded-[22px] bg-white/82 p-4 text-center shadow-[0_10px_22px_rgba(145,177,209,0.09)]">
                  <p className="text-sm font-black text-[#8fa0c2]">{TYPE_LABELS[stat.question_type] || stat.question_type}</p>
                  <p className="mt-2 text-2xl font-extrabold text-[#354172]">{stat.correct} / {stat.total}</p>
                  <p className="mt-1 text-sm font-bold text-[#6f7da8]">{stat.score_percent}%</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {(result.wrong_questions || []).length > 0 && (
                <Link to={`/eiken-pre2?source_attempt_id=${encodeURIComponent(result.attempt_id)}`} className="pill-button inline-block px-5 py-3">
                  錯題だけ再チャレンジ
                </Link>
              )}
              <Link to="/eiken-pre2" className="ghost-button inline-block px-5 py-3">もう一度全部チャレンジ</Link>
              <Link to={`/eiken-pre2/wrong-review?student_id=${encodeURIComponent(result.student_id)}`} className="ghost-button inline-block px-5 py-3">
                錯題リストを見る
              </Link>
              <Link to="/" className="ghost-button inline-block px-5 py-3">
                ホームへ戻る
              </Link>
            </div>

            <div className="mt-6">
              <h3 className="display-font text-xl font-extrabold text-[#354172]">まちがえた問題</h3>
              {(result.wrong_questions || []).length === 0 ? (
                <div className="mt-3 rounded-[24px] bg-white/78 p-5 text-center font-bold text-[#6f7da8]">
                  全問せいかい！よくできました。
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  {result.wrong_questions.map((item) => (
                    <article key={item.question_id} className="rounded-[22px] bg-white/82 p-4 shadow-[0_10px_22px_rgba(145,177,209,0.09)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#6176aa]">
                          Q{item.question_no || item.question_id}
                        </span>
                        <span className="rounded-full bg-[#fff2bb] px-3 py-1 text-xs font-black text-[#69557e]">
                          {TYPE_LABELS[item.question_type] || item.question_type}
                        </span>
                      </div>
                      <p className="mt-3 truncate text-base font-extrabold text-[#354172]">
                        {item.question_text || item.prompt}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm font-black sm:grid-cols-2">
                        <p className="rounded-[16px] bg-rose-50 p-3 text-rose-700">
                          あなたの答え：{item.student_answer || '未回答'}
                        </p>
                        <p className="rounded-[16px] bg-[#f0fbf2] p-3 text-[#2f6445]">
                          正しい答え：{item.correct_option}
                          {item.correct_answer_text ? ` / ${item.correct_answer_text}` : ''}
                        </p>
                      </div>
                      <Link to={`/eiken-pre2?source_attempt_id=${encodeURIComponent(result.attempt_id)}`} className="ghost-button mt-3 inline-block px-4 py-2 text-sm">
                        もう一度チャレンジ
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </motion.section>
    </div>
  );
}
