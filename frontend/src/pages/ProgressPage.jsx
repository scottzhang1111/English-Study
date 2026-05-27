import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TtsButton from '../components/TtsButton';
import {
  EQBadge,
  EQInfoCard,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';
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

function StatCard({ value, label, tone = 'gold' }) {
  return (
    <EQInfoCard title={label} value={value} tone={tone} />
  );
}

function DayCard({ day, active, onClick }) {
  const total = Math.max(1, day.studied_count || 0);
  const correctPercent = Math.min(100, Math.round(((day.correct_count || 0) / total) * 100));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`eq-fantasy-quest-card w-full text-left ${active ? 'is-featured' : ''}`}
      style={{ '--eq-fantasy-accent': active ? '#ffd35a' : '#35d9ff' }}
    >
      <span className="eq-fantasy-quest-card__icon" aria-hidden="true">
        日
      </span>
      <span className="eq-fantasy-quest-card__body">
        <span className="eq-fantasy-quest-card__topline">
          <span>
            <strong className="block text-base font-black text-[#fff0b5]">{formatDate(day.study_date)}</strong>
            <span className="eq-caption mt-1 block">{day.studied_count || 0} words</span>
          </span>
          <EQBadge tone={active ? 'gold' : 'cyan'}>
            {day.correct_count || 0} / {day.studied_count || 0}
          </EQBadge>
        </span>
        <span className="eq-progress-bar mt-3 block" style={{ '--eq-progress': `${correctPercent}%` }} />
      </span>
    </button>
  );
}

function WordRow({ word }) {
  return (
    <EQInfoCard
      title={word.word}
      value={word.japanese || '意味を確認中'}
      tone="purple"
      badges={
        <>
          <EQBadge tone="green">正解 {word.correct_count}</EQBadge>
          <EQBadge tone="rose">まちがい {word.wrong_count}</EQBadge>
          <EQBadge tone="cyan">習熟 {word.mastery}%</EQBadge>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <TtsButton text={word.word} label="単語" />
      </div>
      {word.example ? (
        <EQPanel tone="cyan">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="eq-caption">{word.example}</p>
            <TtsButton text={word.example} label="例文" />
          </div>
        </EQPanel>
      ) : null}
    </EQInfoCard>
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
  const activeDate = selectedDay?.study_date || latestDay;
  const completionRate = useMemo(() => {
    if (!selectedDay?.studied_count) return 0;
    return Math.min(100, Math.round((selectedDay.correct_count / selectedDay.studied_count) * 100));
  }, [selectedDay]);

  if (error) {
    return (
      <div className="eq-learning-hub-page">
        <EQMobileShell className="eq-learning-hub-screen">
          <EQPageHeader
            eyebrow="Progress"
            title="学習レポート"
            subtitle="日ごとの記録"
            icon="記"
          />
          <EQPanel title="読み込みエラー" tone="rose">
            <p className="eq-caption">{error}</p>
          </EQPanel>
        </EQMobileShell>
      </div>
    );
  }

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <EQPageHeader
          eyebrow="Progress"
          title="学習レポート"
          subtitle={`${data?.child?.name || '子ども'} の学習を日ごとに確認`}
          icon="記"
        />

        <section className="grid gap-5">
          <EQPanel title="毎日のがんばり" eyebrow="Summary" tone="gold">
            <EQPrimaryButton type="button" onClick={() => navigate('/flashcard')} fullWidth>
              今日も学習
            </EQPrimaryButton>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard value={data?.total_studies ?? 0} label="合計で学習した単語" tone="gold" />
              <StatCard value={data?.study_days ?? 0} label="学習した日数" tone="cyan" />
              <StatCard value={latestDay ? formatDate(latestDay) : '-'} label="最新の学習日" tone="purple" />
            </div>
          </EQPanel>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.25fr]">
            <EQPanel title="日ごとの記録" tone="cyan">
              <p className="eq-caption">日付を押すと、その日のまとめが見られます。</p>
              <div className="grid gap-3">
                {days.length ? (
                  days.map((day) => (
                    <DayCard
                      key={day.study_date}
                      day={day}
                      active={activeDate === day.study_date}
                      onClick={() => navigate(`/progress?date=${encodeURIComponent(day.study_date)}`)}
                    />
                  ))
                ) : (
                  <EQInfoCard title="まだ学習記録がありません" tone="cyan">
                    学習を始めるとここに記録が表示されます。
                  </EQInfoCard>
                )}
              </div>
            </EQPanel>

            <EQPanel title={formatDate(activeDate || '') || '今日のまとめ'} eyebrow="Selected Day" tone="gold">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard value={selectedDay?.studied_count ?? 0} label="学習した単語" tone="gold" />
                <StatCard value={selectedDay?.correct_count ?? 0} label="正解した数" tone="green" />
                <StatCard value={selectedDay?.wrong_count ?? 0} label="まちがえた数" tone="rose" />
              </div>

              <EQInfoCard title="正解率" value={`${completionRate}%`} tone="amber">
                <div className="eq-progress-bar" style={{ '--eq-progress': `${completionRate}%` }} />
              </EQInfoCard>

              <EQPanel title="この日に学習した単語" tone="purple">
                <div className="grid gap-3">
                  {selectedDay?.words?.length ? (
                    selectedDay.words.map((word) => <WordRow key={`${word.vocab_id}-${word.last_studied_at}`} word={word} />)
                  ) : (
                    <EQInfoCard title="単語詳細はまだありません" tone="purple">
                      この日の単語詳細があると、ここに表示されます。
                    </EQInfoCard>
                  )}
                </div>
              </EQPanel>
            </EQPanel>
          </div>
        </section>
      </EQMobileShell>
    </div>
  );
}
