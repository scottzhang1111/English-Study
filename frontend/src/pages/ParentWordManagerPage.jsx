import { useEffect, useMemo, useState } from 'react';
import WebLearningLayout from '../components/WebLearningLayout';
import { useChildren } from '../ChildrenContext';
import {
  getChildWordStatus,
  updateChildStudyMode,
  updateChildWordStatus,
  updateChildWordsBulkStatus,
} from '../api';

const STATUS_LABELS = {
  mastered: '覚えた',
  learning: '練習中',
  review: '復習',
  priority: '重点',
  new: '未学習',
};

const STATUS_STYLES = {
  mastered: 'bg-emerald-50 text-emerald-700',
  learning: 'bg-sky-50 text-sky-700',
  review: 'bg-amber-50 text-amber-700',
  priority: 'bg-rose-50 text-rose-700',
  new: 'bg-slate-100 text-slate-600',
};

const STUDY_MODES = [
  { id: 'normal', label: '通常', description: '覚えた単語をスキップ' },
  { id: 'full_review', label: '全体復習', description: '覚えた単語も少しだけ出す' },
  { id: 'exam_mode', label: '試験モード', description: '覚えた単語と苦手単語を多めに出す' },
];

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.new;
}

export default function ParentWordManagerPage() {
  const { children, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();
  const [childId, setChildId] = useState(selectedChildId || '');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [levels, setLevels] = useState([]);
  const [words, setWords] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [studyMode, setStudyMode] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedChild = useMemo(
    () => children.find((child) => String(child.id) === String(childId)) || null,
    [children, childId],
  );

  useEffect(() => {
    if (!childId && children[0]?.id) {
      setChildId(String(selectedChildId || children[0].id));
    }
  }, [childId, children, selectedChildId]);

  const loadWords = async () => {
    if (!childId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getChildWordStatus({ childId, level, search });
      setWords(payload.words || []);
      setLevels(payload.levels || []);
      setStudyMode(payload.study_mode || 'normal');
      setSelectedIds([]);
    } catch (err) {
      setError(err.message || '単語の状態を読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWords();
  }, [childId, level]);

  const toggleSelected = (wordId) => {
    const id = String(wordId);
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const toggleAllVisible = () => {
    const visibleIds = words.map((word) => String(word.id));
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visibleIds);
  };

  const refreshAfterSave = async (nextMessage) => {
    await loadWords();
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(''), 2200);
  };

  const updateOne = async (word, status) => {
    setSaving(true);
    setError('');
    try {
      await updateChildWordStatus({
        childId,
        wordId: word.id,
        status,
        isParentMarkedMastered: status === 'mastered',
      });
      await refreshAfterSave(`${word.word} を「${getStatusLabel(status)}」にしました。`);
    } catch (err) {
      setError(err.message || '単語の状態を更新できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const updateBulk = async (status) => {
    if (!selectedIds.length) return;
    setSaving(true);
    setError('');
    try {
      await updateChildWordsBulkStatus({ childId, wordIds: selectedIds, status });
      await refreshAfterSave(`${selectedIds.length}語を「${getStatusLabel(status)}」にしました。`);
    } catch (err) {
      setError(err.message || 'まとめて更新できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const saveStudyMode = async (nextMode) => {
    setStudyMode(nextMode);
    setSaving(true);
    setError('');
    try {
      await updateChildStudyMode({ childId, studyMode: nextMode });
      await refreshChildren();
      setMessage('学習モードを更新しました。');
      window.setTimeout(() => setMessage(''), 2200);
    } catch (err) {
      setError(err.message || '学習モードを更新できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WebLearningLayout title="単語管理" subtitle="子どもごとに覚えた単語を管理します。">
      <div className="grid gap-5">
        <section className="panel px-5 py-5 sm:px-7">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr_auto] lg:items-end">
            <label className="grid gap-2 text-sm font-bold text-[#51658a]">
              子ども
              <select
                value={childId}
                onChange={(event) => {
                  setChildId(event.target.value);
                  setSelectedChildId(event.target.value);
                }}
                className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-[#354172] shadow-sm"
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-[#51658a]">
              英検レベル
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-[#354172] shadow-sm"
              >
                <option value="">すべて</option>
                {levels.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-[#51658a]">
              単語検索
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') loadWords();
                }}
                placeholder="例: decide / 決心"
                className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-[#354172] shadow-sm"
              />
            </label>

            <button type="button" onClick={loadWords} className="pill-button px-6 py-3" disabled={loading}>
              検索
            </button>
          </div>
        </section>

        <section className="panel px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#354172]">学習モード</h2>
              <p className="mt-1 text-sm font-bold text-[#6f7da8]">{selectedChild?.name || '子ども'} の毎日の単語選びに使います。</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {STUDY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => saveStudyMode(mode.id)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                    studyMode === mode.id ? 'border-[#f0c24f] bg-[#fff7d6] text-[#5d4700]' : 'border-white/80 bg-white/82 text-[#51658a]'
                  }`}
                  disabled={saving}
                >
                  {mode.label}
                  <span className="mt-1 block text-xs font-bold opacity-75">{mode.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {(message || error) && (
          <div className={`rounded-3xl px-5 py-4 text-sm font-bold ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {error || message}
          </div>
        )}

        <section className="panel overflow-hidden px-0 py-0">
          <div className="flex flex-col gap-3 border-b border-white/80 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#354172]">単語一覧</h2>
              <p className="mt-1 text-sm font-bold text-[#6f7da8]">{words.length}語 / 選択 {selectedIds.length}語</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => updateBulk('mastered')} disabled={!selectedIds.length || saving} className="pill-button px-4 py-2 text-sm disabled:opacity-40">
                選択を覚えた
              </button>
              <button type="button" onClick={() => updateBulk('priority')} disabled={!selectedIds.length || saving} className="ghost-button px-4 py-2 text-sm disabled:opacity-40">
                選択を重点
              </button>
              <button type="button" onClick={() => updateBulk('learning')} disabled={!selectedIds.length || saving} className="ghost-button px-4 py-2 text-sm disabled:opacity-40">
                選択を練習中
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead className="bg-[#f8fbff] text-xs font-black text-[#6f7da8]">
                <tr>
                  <th className="w-12 px-5 py-3">
                    <input type="checkbox" checked={words.length > 0 && words.every((word) => selectedIds.includes(String(word.id)))} onChange={toggleAllVisible} />
                  </th>
                  <th className="px-4 py-3">単語</th>
                  <th className="px-4 py-3">日本語</th>
                  <th className="px-4 py-3">レベル</th>
                  <th className="px-4 py-3">状態</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/80 bg-white/60">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center text-sm font-bold text-[#6f7da8]">読み込み中...</td>
                  </tr>
                ) : words.map((word) => (
                  <tr key={word.id} className="text-sm font-bold text-[#354172]">
                    <td className="px-5 py-3">
                      <input type="checkbox" checked={selectedIds.includes(String(word.id))} onChange={() => toggleSelected(word.id)} />
                    </td>
                    <td className="px-4 py-3 text-base font-black">{word.word}</td>
                    <td className="max-w-[320px] px-4 py-3 text-[#51658a]">{word.japanese || word.meaningJa}</td>
                    <td className="px-4 py-3">{word.level}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${STATUS_STYLES[word.status] || STATUS_STYLES.new}`}>
                        {getStatusLabel(word.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => updateOne(word, 'mastered')} disabled={saving} className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                          覚えた
                        </button>
                        <button type="button" onClick={() => updateOne(word, 'priority')} disabled={saving} className="rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                          重点
                        </button>
                        <button type="button" onClick={() => updateOne(word, 'learning')} disabled={saving} className="rounded-full bg-sky-50 px-3 py-2 text-xs font-black text-sky-700">
                          練習中
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </WebLearningLayout>
  );
}
