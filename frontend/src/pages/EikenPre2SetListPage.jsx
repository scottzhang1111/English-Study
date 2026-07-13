import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  EQ_ASSETS,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQFantasyDropdown,
  EQHeroHeader,
  EQPageShell,
} from '../components/eigo';
import { getEikenPre2Sets } from '../api';

export default function EikenPre2SetListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceAttemptId = searchParams.get('source_attempt_id') || '';
  const [sets, setSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getEikenPre2Sets()
      .then((payload) => {
        if (!active) return;
        const nextSets = payload.sets || [];
        setSets(nextSets);
        setSelectedSetId((current) => current || nextSets[0]?.set_id || '');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || '英検準2級のセットを読み込めませんでした。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setOptions = useMemo(
    () => sets.map((item) => ({
      value: item.set_id,
      label: item.set_id,
    })),
    [sets],
  );
  const selectedSet = sets.find((item) => item.set_id === selectedSetId);

  function startPractice() {
    if (!selectedSetId) return;
    const retryQuery = sourceAttemptId ? `?source_attempt_id=${encodeURIComponent(sourceAttemptId)}` : '';
    navigate(`/eiken-pre2/quiz/${encodeURIComponent(selectedSetId)}${retryQuery}`);
  }

  return (
    <EQPageShell withBottomNav bottomNavClassName="eq-learning-hub-bottom-nav">
      <EQHeroHeader
        title="英検準2級 模擬テスト"
        subtitle="セットを選んで、1問ずつ練習しよう"
        bgImage={EQ_ASSETS.bg.eikenReal}
        fairyImage={EQ_ASSETS.spirit.happy}
        elementLabel="英"
        progressText="PRE-2"
      />

      <EQFantasyCard
        hideHeader
        className="eq-eiken3-set-selector-card"
        title="英検準2級 模擬テスト"
        subtitle="セットを選んで練習しよう"
      >
        <div className="grid gap-4">
          {error ? (
            <div className="rounded-[18px] border border-rose-300/50 bg-rose-950/45 px-4 py-3 text-sm font-black text-rose-100">
              {error}
            </div>
          ) : null}

          <EQFantasyDropdown
            label="セットを選ぶ"
            value={selectedSetId}
            options={setOptions}
            onChange={(value) => setSelectedSetId(value)}
            placeholder="セットを選ぶ"
          />

          <div className="flex flex-wrap gap-2">
            <EQFantasyBadge iconImage={EQ_ASSETS.ui.coinIcon}>
              問題数 {selectedSet?.question_count || '-'}
            </EQFantasyBadge>
            <EQFantasyBadge iconImage={EQ_ASSETS.ui.iconStudy}>45秒チャレンジ</EQFantasyBadge>
            <EQFantasyBadge iconImage={EQ_ASSETS.ui.iconStudy}>即時判定</EQFantasyBadge>
          </div>

          <EQFantasyButton
            fullWidth
            icon="英"
            onClick={startPractice}
            disabled={loading || !selectedSetId}
          >
            練習を開始する
          </EQFantasyButton>

          <Link to="/eiken-pre2/wrong-review" className="eiken-real-trial-secondary-action text-center">
            まちがい復習へ
          </Link>
        </div>
      </EQFantasyCard>
    </EQPageShell>
  );
}
