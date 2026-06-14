import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQ_ASSETS,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQFantasyDropdown,
  EQHeroHeader,
  EQPageShell,
} from '../components/eigo';
import { getEiken3Sets } from '../api';

const PART_OPTIONS = [
  {
    id: 'part1',
    label: '第1部：短文の語句空所補充',
    badges: ['問題数 15', '選択問題'],
    buttonLabel: '練習を開始する',
  },
  {
    id: 'part2',
    label: '第2部：会話文の文空所補充',
    badges: ['問題数 5', '会話文'],
    buttonLabel: '練習を開始する',
  },
  {
    id: 'part3',
    label: '第3部：長文読解',
    badges: ['問題数 10', '長文読解'],
    buttonLabel: '練習を開始する',
  },
  {
    id: 'writing',
    label: 'Writing：AI作文練習へ',
    badges: ['Writing 2', 'AI作文'],
    buttonLabel: 'AI作文練習へ',
  },
];

export default function Eiken3SetListPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('part1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getEiken3Sets()
      .then((payload) => {
        if (!active) return;
        const nextSets = payload.sets || [];
        setSets(nextSets);
        setSelectedSetId((current) => current || nextSets[0]?.set_id || 'G3SET01');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || '英検3級セットを読み込めませんでした。');
        setSelectedSetId((current) => current || 'G3SET01');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setOptions = useMemo(() => {
    const source = sets.length
      ? sets
      : Array.from({ length: 10 }, (_, index) => ({ set_id: `G3SET${String(index + 1).padStart(2, '0')}` }));
    return source.map((item) => ({
      value: item.set_id,
      label: item.set_id,
    }));
  }, [sets]);

  const partOptions = useMemo(
    () => PART_OPTIONS.map((part) => ({
      value: part.id,
      label: part.label,
    })),
    [],
  );
  const selectedPart = PART_OPTIONS.find((part) => part.id === selectedPartId) || PART_OPTIONS[0];
  const selectedSet = selectedSetId || setOptions[0]?.value || 'G3SET01';
  const isWriting = selectedPart.id === 'writing';

  function startPractice() {
    if (isWriting) {
      navigate(`/essay-check?set=${encodeURIComponent(selectedSet)}&type=writing`);
      return;
    }
    navigate(`/eiken3/quiz/${encodeURIComponent(selectedSet)}?part=${encodeURIComponent(selectedPart.id)}`);
  }

  return (
    <EQPageShell withBottomNav bottomNavClassName="eq-learning-hub-bottom-nav">
      <EQHeroHeader
        title="英検3級 模擬テスト"
        subtitle="セットと問題を選んで練習しよう"
        bgImage={EQ_ASSETS.bg.eikenReal}
        fairyImage={EQ_ASSETS.spirit.happy}
        emblemImage={EQ_ASSETS.app.logoMark}
        elementLabel="英"
        progressText="G3"
      />

      <EQFantasyCard
        eyebrow="REAL MOCK TRIAL"
        title="英検3級 模擬テスト"
        subtitle="セットと問題を選んで練習しよう"
        iconImage={EQ_ASSETS.ui.quizScroll}
        cornerDecoration={EQ_ASSETS.ui.flameStreak}
      >
        <div className="grid gap-5">
          {error ? (
            <div className="rounded-[18px] border border-rose-300/50 bg-rose-950/45 px-4 py-3 text-sm font-black text-rose-100">
              {error}
            </div>
          ) : null}

          <EQFantasyDropdown
            label="セットを選ぶ"
            value={selectedSet}
            options={setOptions}
            onChange={(value) => setSelectedSetId(value)}
            placeholder="セットを選ぶ"
          />

          <EQFantasyDropdown
            label="問題パートを選ぶ"
            value={selectedPartId}
            options={partOptions}
            onChange={(value) => setSelectedPartId(value)}
            placeholder="問題パートを選ぶ"
          />

          <div className="flex flex-wrap gap-2">
            {selectedPart.badges.map((badge) => (
              <EQFantasyBadge
                key={badge}
                iconImage={isWriting ? EQ_ASSETS.ui.iconStudy : EQ_ASSETS.ui.coinIcon}
              >
                {badge}
              </EQFantasyBadge>
            ))}
          </div>

          <EQFantasyButton
            fullWidth
            iconImage={isWriting ? EQ_ASSETS.ui.iconStudy : EQ_ASSETS.ui.coinIcon}
            onClick={startPractice}
            disabled={loading && !selectedSet}
          >
            {selectedPart.buttonLabel}
          </EQFantasyButton>
        </div>
      </EQFantasyCard>
    </EQPageShell>
  );
}
