import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import { getProgressData } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function formatDate(dateText) {
  if (!dateText) return '';
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function StatCard({ value, label }) {
  return (
    <div className="rounded-[28px] bg-white/72 px-5 py-5 text-center shadow-[0_14px_34px_rgba(145,177,209,0.12)]">
      <p className="display-font text-3xl font-extrabold text-[#354172]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#6f7da8]">{label}</p>
    </div>
  );
}

function DayCard({ day, active, onClick }) {
  const total = Math.max(1, day.studied_count || 0);
  const correctPercent = Math.min(100, Math.round(((day.correct_count || 0) / total) * 100));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[28px] border px-5 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] ${
        active
          ? 'border-[#ffd45b] bg-[linear-gradient(180deg,#fff8cf_0%,#ffe983_100%)] shadow-[0_18px_32px_rgba(255,199,53,0.24)]'
          : 'border-white/80 bg-white/74 shadow-[0_12px_28px_rgba(145,177,209,0.12)]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#354172]">{formatDate(day.study_date)}</p>
          <p className="mt-1 text-xs font-bold text-[#7b88b1]">{day.studied_count || 0} words</p>
        </div>
        <span className="rounded-full bg-white/78 px-3 py-1 text-xs font-black text-[#354172]">
          {day.correct_count || 0} / {day.studied_count || 0}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/72">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ffd84f,#54d8ff)]"
          style={{ width: `${correctPercent}%` }}
        />
      </div>
    </button>
  );
}

function WordRow({ word }) {
  return (
    <div className="rounded-[24px] bg-white/76 px-5 py-4 shadow-[0_10px_24px_rgba(145,177,209,0.10)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="display-font text-2xl font-extrabold text-[#354172]">{word.word}</p>
          <p className="mt-1 text-sm font-bold text-[#6f7da8]">{word.japanese || '意味を確認中'}</p>
        </div>
        <div className="flex gap-2 text-xs font-black">
          <span className="rounded-full bg-[#e9f9ee] px-3 py-1 text-[#2f7b55]">正解 {word.correct_count}</span>
          <span className="rounded-full bg-[#fff0f4] px-3 py-1 text-[#a9506b]">まちがい {word.wrong_count}</span>
          <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-[#5571a5]">習熟 {word.mastery}%</span>
        </div>
      </div>
      {word.example ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-[#5f6f94]">{word.example}</p>
      ) : null}
    </div>
  );
}

export default function ProgressPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const selectedDate = searchParams.get('date') || '';
  const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';

  useEffect(() => {
    setError('');
    getProgressData({ childId, date: selectedDate })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [childId, selectedDate]);

  const selectedDay = data?.selected_day || null;
  const days = data?.days || [];
  const latestDay = days[0]?.study_date || selectedDay?.study_date || '';
  const completionRate = useMemo(() => {
    if (!selectedDay?.studied_count) return 0;
    return Math.min(100, Math.round((selectedDay.correct_count / selectedDay.studied_count) * 100));
  }, [selectedDay]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
        <HeaderBar subtitle="学習レポート" />
        <div className="panel px-5 py-5 text-sm font-bold text-rose-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="学習レポート" />

      <section className="grid gap-5">
        <article className="rounded-[40px] border border-white/80 bg-white/86 px-6 py-6 shadow-[0_18px_44px_rgba(145,177,209,0.16)]">
          <p className="text-sm font-black text-[#6f7da8]">学習の記録</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="display-font text-3xl font-extrabold text-[#354172]">毎日のがんばり</h1>
              <p className="mt-2 text-sm font-semibold text-[#6f7da8]">
                {data?.child?.name || '子ども'} の学習を、日ごとに確認できます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/flashcard')}
              className="pill-button px-6 py-3"
            >
              今日も学習
            </button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatCard value={data?.total_studies ?? 0} label="合計で学習した単語" />
            <StatCard value={data?.study_days ?? 0} label="学習した日数" />
            <StatCard value={latestDay ? formatDate(latestDay) : '-'} label="最近の学習日" />
          </div>
        </article>

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.25fr]">
          <article className="rounded-[40px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(242,249,255,0.86)_100%)] px-5 py-5 shadow-[0_18px_44px_rgba(145,177,209,0.14)]">
            <h2 className="display-font text-2xl font-extrabold text-[#354172]">日ごとの記録</h2>
            <p className="mt-2 text-sm font-semibold text-[#7b88b1]">日にちを押すと、その日のまとめが見られます。</p>
            <div className="mt-5 grid gap-3">
              {days.length ? (
                days.map((day) => (
                  <DayCard
                    key={day.study_date}
                    day={day}
                    active={(selectedDay?.study_date || latestDay) === day.study_date}
                    onClick={() => navigate(`/progress?date=${encodeURIComponent(day.study_date)}`)}
                  />
                ))
              ) : (
                <div className="rounded-[28px] bg-white/74 px-5 py-8 text-center text-sm font-bold text-[#7b88b1]">
                  まだ学習記録がありません。
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[40px] border border-white/80 bg-white/86 px-6 py-6 shadow-[0_18px_44px_rgba(145,177,209,0.16)]">
            <p className="text-sm font-black text-[#6f7da8]">毎日の詳細</p>
            <h2 className="display-font mt-1 text-3xl font-extrabold text-[#354172]">
              {formatDate(selectedDay?.study_date || latestDay || '') || '今日のまとめ'}
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatCard value={selectedDay?.studied_count ?? 0} label="学習した単語" />
              <StatCard value={selectedDay?.correct_count ?? 0} label="正解した数" />
              <StatCard value={selectedDay?.wrong_count ?? 0} label="まちがえた数" />
            </div>

            <div className="mt-5 rounded-[28px] bg-[#f3fbff] px-5 py-4">
              <div className="flex items-center justify-between text-xs font-black text-[#6f7da8]">
                <span>正解率</span>
                <span>{completionRate}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#ffd84f,#54d8ff)]"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-black text-[#354172]">この日に学習した単語</h3>
              <div className="mt-3 grid gap-3">
                {selectedDay?.words?.length ? (
                  selectedDay.words.map((word) => <WordRow key={`${word.vocab_id}-${word.last_studied_at}`} word={word} />)
                ) : (
                  <div className="rounded-[28px] bg-[#f8fcff] px-5 py-8 text-center text-sm font-bold text-[#7b88b1]">
                    この日の単語詳細はまだありません。
                  </div>
                )}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
