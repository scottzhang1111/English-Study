import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EQBottomNav } from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
import { getEiken3Sets } from '../api';

export default function Eiken3SetListPage() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getEiken3Sets()
      .then((payload) => {
        if (!active) return;
        setSets(payload.sets || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || '英検3級セットを読み込めませんでした。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="eiken-exam-page eiken-real-trial-page eiken3-mock-page mx-auto max-w-[1440px] px-3 pb-28 pt-2 text-[#26376d] lg:px-5 lg:py-4">
        <div className="eiken-real-trial-compact-wrap md:hidden">
          <CompactPageHeader
            title="英検3級"
            subtitle="模擬テストに挑戦"
            backgroundImage="/assets/eigo-quest/learning-hub/英検本番形式.png"
            elementLabel="英"
            progressText="G3"
            helperImage="/assets/eigo-quest/spirit_assets/happy.png"
            variant="eiken-real"
          />
        </div>

        <main className="eiken-real-trial-entry-layout">
          <section className="eiken-real-trial-entry-card eiken3-mock-entry-card">
            <div className="eiken-real-trial-entry-head">
              <span className="eiken-real-trial-crest" aria-hidden="true">英</span>
              <div>
                <p>GRADE 3 MOCK TEST</p>
                <h1>英検3級 模擬テスト</h1>
                <strong>セットを選んで30問に挑戦</strong>
              </div>
            </div>

            <div className="eiken-real-trial-badges">
              <span><i>?</i> 30問</span>
              <span><i>文</i> 長文3題</span>
              <span><i>W</i> Writingあり</span>
            </div>

            {error && <div className="eiken3-mock-alert">{error}</div>}

            {loading ? (
              <div className="eiken-real-trial-status-card eiken3-mock-status" role="status" aria-live="polite">
                <span className="eiken-real-trial-status-orb" aria-hidden="true" />
                <p>読み込み中</p>
                <strong>セットを準備しています...</strong>
              </div>
            ) : (
              <div className="eiken3-mock-set-grid">
                {sets.map((item) => (
                  <Link
                    key={item.set_id}
                    to={`/eiken3/quiz/${encodeURIComponent(item.set_id)}`}
                    className="eiken3-mock-set-button"
                  >
                    <span>Mock Set</span>
                    <strong>{item.set_id}</strong>
                    <small>
                      {item.question_count}問 / 長文{item.passage_count} / Writing {item.writing_count}
                    </small>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
      <EQBottomNav className="eiken-real-trial-bottom-nav" />
    </>
  );
}
