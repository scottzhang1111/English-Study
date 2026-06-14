import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EQBottomNav } from '../components/eigo';
import CompactPageHeader from '../components/eigo/CompactPageHeader';
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

function MockDropdown({ label, value, options, open, onToggle, onSelect }) {
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <label className="eiken3-mock-dropdown-field">
      <span>{label}</span>
      <div className={`eiken-real-custom-select eiken3-mock-dropdown ${open ? 'is-open' : ''}`}>
        <button
          type="button"
          className="eiken-real-custom-select-trigger"
          onClick={onToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{selected?.label || '選択してください'}</span>
          <i aria-hidden="true">{open ? '⌃' : '⌄'}</i>
        </button>
        {open && (
          <div className="eiken-real-custom-select-menu eiken3-mock-dropdown-menu" role="listbox">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={isSelected ? 'is-selected' : ''}
                  onClick={() => onSelect(option.value)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span aria-hidden="true">{isSelected ? '✓' : ''}</span>
                  <strong>{option.label}</strong>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </label>
  );
}

export default function Eiken3SetListPage() {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [sets, setSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('part1');
  const [openDropdown, setOpenDropdown] = useState('');
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

  useEffect(() => {
    function handlePointerDown(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpenDropdown('');
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const setOptions = useMemo(() => {
    const source = sets.length ? sets : Array.from({ length: 10 }, (_, index) => ({ set_id: `G3SET${String(index + 1).padStart(2, '0')}` }));
    return source.map((item) => ({
      value: item.set_id,
      label: item.set_id,
    }));
  }, [sets]);

  const partOptions = PART_OPTIONS.map((part) => ({
    value: part.id,
    label: part.label,
  }));
  const selectedPart = PART_OPTIONS.find((part) => part.id === selectedPartId) || PART_OPTIONS[0];
  const selectedSet = selectedSetId || setOptions[0]?.value || 'G3SET01';

  function startPractice() {
    setOpenDropdown('');
    if (selectedPart.id === 'writing') {
      navigate(`/essay-check?set=${encodeURIComponent(selectedSet)}&type=writing`);
      return;
    }
    navigate(`/eiken3/quiz/${encodeURIComponent(selectedSet)}?part=${encodeURIComponent(selectedPart.id)}`);
  }

  return (
    <>
      <div className="eiken-exam-page eiken-real-trial-page eiken3-mock-page eiken3-mock-picker-page mx-auto max-w-[1440px] px-3 text-[#26376d] lg:px-5">
        <div className="eiken-real-trial-compact-wrap eiken3-mock-hero">
          <CompactPageHeader
            title="英検3級 模擬テスト"
            subtitle="セットと問題を選んで練習しよう"
            backgroundImage="/assets/eigo-quest/learning-hub/英検本番形式.png"
            elementLabel="英"
            progressText="G3"
            helperImage="/assets/eigo-quest/spirit_assets/happy.png"
            variant="eiken-real"
          />
        </div>

        <main className="eiken-real-trial-entry-layout">
          <section className="eiken-real-trial-entry-card eiken3-mock-entry-card eiken3-mock-picker-card">
            <div className="eiken-real-trial-entry-head">
              <span className="eiken-real-trial-crest" aria-hidden="true">英</span>
              <div>
                <p>REAL MOCK TRIAL</p>
                <h1>英検3級 模擬テスト</h1>
                <strong>セットと問題を選んで練習しよう</strong>
              </div>
            </div>

            {error && <div className="eiken3-mock-alert">{error}</div>}

            <div className="eiken3-mock-picker-form" ref={dropdownRef}>
              <MockDropdown
                label="セットを選ぶ"
                value={selectedSet}
                options={setOptions}
                open={openDropdown === 'set'}
                onToggle={() => setOpenDropdown((current) => (current === 'set' ? '' : 'set'))}
                onSelect={(value) => {
                  setSelectedSetId(value);
                  setOpenDropdown('');
                }}
              />

              <MockDropdown
                label="問題パートを選ぶ"
                value={selectedPartId}
                options={partOptions}
                open={openDropdown === 'part'}
                onToggle={() => setOpenDropdown((current) => (current === 'part' ? '' : 'part'))}
                onSelect={(value) => {
                  setSelectedPartId(value);
                  setOpenDropdown('');
                }}
              />
            </div>

            <div className="eiken-real-trial-badges eiken3-mock-part-badges">
              {selectedPart.badges.map((badge) => (
                <span key={badge}>
                  <i aria-hidden="true">{badge.includes('Writing') ? 'W' : '?'}</i>
                  {badge}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={startPractice}
              className="eiken-real-trial-start eiken3-mock-start"
              disabled={loading && !selectedSet}
            >
              <span className="eiken-real-trial-start-compass" aria-hidden="true">◇</span>
              <span>{selectedPart.buttonLabel}</span>
              <span className="eiken-real-trial-start-arrow" aria-hidden="true">›</span>
            </button>
          </section>
        </main>
      </div>
      <EQBottomNav className="eiken-real-trial-bottom-nav" />
    </>
  );
}
