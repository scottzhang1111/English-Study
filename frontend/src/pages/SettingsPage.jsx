import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import {
  deleteChildProfile,
  getChildStarterOptions,
  getChildren,
  saveChildProfile,
} from '../api';

const DEFAULT_FORM = {
  name: '',
  grade: '1',
  target_level: '三級',
  daily_target: 20,
};

const GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6'];
const CHILD_STORAGE_KEY = 'selected_child_id';

const pokemonArtwork = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const pokemonSprite = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

const DEFAULT_STARTER_OPTIONS = [
  { id: 4, name: 'ヒトカゲ', image_url: pokemonArtwork(4), sprite_url: pokemonSprite(4), types: [{ name: 'fire' }] },
  { id: 7, name: 'ゼニガメ', image_url: pokemonArtwork(7), sprite_url: pokemonSprite(7), types: [{ name: 'water' }] },
  { id: 1, name: 'フシギダネ', image_url: pokemonArtwork(1), sprite_url: pokemonSprite(1), types: [{ name: 'grass' }] },
];

const POKEMON_FALLBACKS = {
  1: { name: 'フシギダネ', description: 'こつこつ学習を支えてくれる、やさしい草タイプ。' },
  4: { name: 'ヒトカゲ', description: 'やる気を明るくしてくれる、元気な炎タイプ。' },
  7: { name: 'ゼニガメ', description: '落ち着いて復習を進められる、頼れる水タイプ。' },
};

const TYPE_LABELS = {
  fire: 'ほのお',
  water: 'みず',
  grass: 'くさ',
};

function getPokemonImage(option) {
  return option?.image_url || option?.sprite_url || '';
}

function getPokemonName(option) {
  const fallback = POKEMON_FALLBACKS[Number(option?.id)];
  return fallback?.name || option?.name || 'パートナー';
}

function getPokemonDescription(option) {
  return POKEMON_FALLBACKS[Number(option?.id)]?.description || 'いっしょに英語学習を進める最初のパートナーです。';
}

function getTypeNames(option) {
  return (option?.types || [])
    .map((type) => TYPE_LABELS[type.name || type] || type.name || type)
    .filter(Boolean);
}

function getSelectedChildId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CHILD_STORAGE_KEY) || '';
}

function clearSelectedChildId() {
  localStorage.removeItem(CHILD_STORAGE_KEY);
  try {
    sessionStorage.removeItem(CHILD_STORAGE_KEY);
  } catch (err) {
    // sessionStorage can be unavailable in restricted browser modes.
  }
}

export default function SettingsPage() {
  const [children, setChildren] = useState([]);
  const [starterOptions, setStarterOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChildId, setEditingChildId] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(getSelectedChildId);
  const [selectedStarterId, setSelectedStarterId] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');

  const selectedStarter = useMemo(
    () => starterOptions.find((option) => String(option.id) === String(selectedStarterId)) || null,
    [starterOptions, selectedStarterId],
  );

  const starterById = useMemo(() => {
    const map = new Map();
    starterOptions.forEach((option) => map.set(String(option.id), option));
    return map;
  }, [starterOptions]);

  const refreshChildren = async () => {
    const payload = await getChildren();
    const list = payload.children || [];
    setChildren(list);
    return list;
  };

  const refreshStarterOptions = async () => {
    setLoadingOptions(true);
    try {
      const payload = await Promise.race([
        getChildStarterOptions(),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('starter options timeout')), 4000)),
      ]);
      const options = payload.options?.length ? payload.options : DEFAULT_STARTER_OPTIONS;
      setStarterOptions(options);
      setSelectedStarterId((prev) => {
        if (prev && options.some((option) => String(option.id) === String(prev))) return prev;
        return options[0] ? String(options[0].id) : '';
      });
    } catch (err) {
      setStarterOptions(DEFAULT_STARTER_OPTIONS);
      setSelectedStarterId((prev) => {
        if (prev && DEFAULT_STARTER_OPTIONS.some((option) => String(option.id) === String(prev))) return prev;
        return String(DEFAULT_STARTER_OPTIONS[0].id);
      });
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    refreshChildren().catch((err) => setProfileError(err.message));
    refreshStarterOptions().catch((err) => setProfileError(err.message));
  }, []);

  const beginAddChild = () => {
    setEditingChildId(null);
    setForm({ ...DEFAULT_FORM });
    if (starterOptions[0]) {
      setSelectedStarterId(String(starterOptions[0].id));
    }
    setProfileError('');
    setProfileMessage('');
    setShowForm(true);
  };

  const beginEditChild = (child) => {
    setEditingChildId(child.id);
    setForm({
      name: child.name || '',
      grade: child.grade || '1',
      target_level: child.target_level || child.targetLevel || '三級',
      daily_target: Number(child.daily_target || child.dailyTarget || 20),
    });
    if (child.starter_pokemon_id) {
      setSelectedStarterId(String(child.starter_pokemon_id));
    } else if (child.partnerMonsterId) {
      setSelectedStarterId(String(child.partnerMonsterId));
    } else if (starterOptions[0]) {
      setSelectedStarterId(String(starterOptions[0].id));
    }
    setProfileError('');
    setProfileMessage('');
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingChildId(null);
    setForm({ ...DEFAULT_FORM });
    setProfileError('');
    setShowForm(false);
  };

  const handleSelectChild = (childId) => {
    localStorage.setItem(CHILD_STORAGE_KEY, String(childId));
    setSelectedChildId(String(childId));
    setProfileMessage('学習する子を切り替えました。');
  };

  const handleSaveProfile = async () => {
    setProfileMessage('');
    setProfileError('');
    try {
      if (!form.name.trim()) {
        throw new Error('名前を入力してください。');
      }
      if (!selectedStarterId) {
        throw new Error('最初のパートナーを選んでください。');
      }

      const payload = await saveChildProfile({
        id: editingChildId ?? undefined,
        name: form.name.trim(),
        grade: form.grade,
        target_level: form.target_level || '三級',
        daily_target: Number(form.daily_target || 20),
        starter_pokemon_id: Number(selectedStarterId),
      });

      const childrenList = await refreshChildren();
      const nextChildId = payload?.child?.id || childrenList[0]?.id;
      if (nextChildId) {
        localStorage.setItem(CHILD_STORAGE_KEY, String(nextChildId));
        setSelectedChildId(String(nextChildId));
      }

      setProfileMessage(editingChildId ? '子どもの設定を更新しました。' : '子どもを登録しました。');
      closeForm();
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const handleDeleteChild = async (childId) => {
    const child = children.find((item) => String(item.id) === String(childId));
    if (!child) return;
    if (!window.confirm(`${child.name} を削除しますか？`)) return;

    setProfileMessage('');
    setProfileError('');
    try {
      await deleteChildProfile(childId);
      const nextChildren = await refreshChildren();
      if (String(selectedChildId) === String(childId)) {
        const nextSelected = nextChildren[0]?.id ? String(nextChildren[0].id) : '';
        if (nextSelected) {
          localStorage.setItem(CHILD_STORAGE_KEY, nextSelected);
        } else {
          clearSelectedChildId();
        }
        setSelectedChildId(nextSelected);
      }
      if (nextChildren.length === 0) {
        clearSelectedChildId();
        setSelectedChildId('');
        setChildren([]);
      }
      if (String(editingChildId) === String(childId)) {
        closeForm();
      }
      setProfileMessage('子どもの設定を削除しました。');
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const hasChildren = children.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="子どもの設定" />

      <div className="grid gap-8">
        {!hasChildren && !showForm && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel px-6 py-10 text-center sm:px-10"
          >
            <h1 className="display-font text-3xl font-extrabold text-[#354172]">まだ子どもが登録されていません</h1>
            <p className="mt-3 text-sm font-bold text-[#6f7da8]">学習を始めるには、まず子どもを追加してください。</p>
            <button type="button" onClick={beginAddChild} className="pill-button mt-7 px-7 py-4 text-base">
              ＋ 子どもを追加
            </button>
          </motion.section>
        )}

        {hasChildren && !showForm && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel px-6 py-6 sm:px-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="display-font text-3xl font-extrabold text-[#354172]">学習する子を選ぶ</h1>
                <p className="mt-2 text-sm font-bold text-[#6f7da8]">今日学習する子どもを選んでください。</p>
              </div>
              <button type="button" onClick={beginAddChild} className="pill-button px-6 py-3">
                ＋ 子どもを追加
              </button>
            </div>

            <div className="mt-7 grid gap-4">
              {children.map((child) => {
                const isSelected = String(selectedChildId) === String(child.id);
                const petOption = starterById.get(String(child.starter_pokemon_id || child.partnerMonsterId));
                const partnerName = petOption ? getPokemonName(petOption) : child.partner_name || child.pet?.name || '';
                const partnerLevel = child.partner_level || child.pet?.level;
                return (
                  <article
                    key={child.id}
                    className={`rounded-[28px] border p-5 shadow-[0_12px_28px_rgba(145,177,209,0.10)] ${
                      isSelected ? 'border-[#f0c24f] bg-[#fff9dc]' : 'border-white/80 bg-white/86'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-extrabold text-[#354172]">{child.name}</h2>
                          {isSelected && (
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#6b5a2d]">
                              選択中
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#61759e]">
                          {child.grade && <span className="rounded-full bg-[#f8fbff] px-3 py-1">学年 {child.grade}</span>}
                          <span className="rounded-full bg-[#f8fbff] px-3 py-1">1日 {child.daily_target || child.dailyTarget || 20} 語</span>
                          {partnerName && (
                            <span className="rounded-full bg-[#fff7d6] px-3 py-1">
                              {partnerName}
                              {partnerLevel ? ` Lv.${partnerLevel}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectChild(child.id)}
                          className="pill-button px-5 py-3 text-sm"
                        >
                          この子で学習する
                        </button>
                        <button
                          type="button"
                          onClick={() => beginEditChild(child)}
                          className="rounded-full border border-white/80 bg-white px-4 py-2 text-xs font-black text-[#6f7da8] transition hover:-translate-y-0.5"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChild(child.id)}
                          className="rounded-full border border-rose-100 bg-white px-4 py-2 text-xs font-black text-rose-700 transition hover:-translate-y-0.5"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </motion.section>
        )}

        {showForm && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel px-6 py-6 sm:px-8"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="display-font text-3xl font-extrabold text-[#354172]">
                  {editingChildId ? '子どもの設定を編集' : '子どもを追加'}
                </h1>
                <p className="mt-2 text-sm font-bold text-[#6f7da8]">基本情報と最初のパートナーを選びます。</p>
              </div>
              {hasChildren && (
                <button type="button" onClick={closeForm} className="ghost-button px-5 py-3 text-sm">
                  一覧へ戻る
                </button>
              )}
            </div>

            <div className="mt-7 grid gap-7">
              <div className="rounded-[30px] border border-white/80 bg-white/84 p-5">
                <h2 className="text-xl font-extrabold text-[#354172]">基本情報</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-bold text-[#354172]">
                    名前
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Haru"
                      className="mt-2 w-full rounded-[22px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172] shadow-[inset_0_1px_2px_rgba(96,110,140,0.05)]"
                    />
                  </label>

                  <label className="text-sm font-bold text-[#354172]">
                    学年
                    <select
                      value={form.grade}
                      onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))}
                      className="mt-2 w-full rounded-[22px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172] shadow-[inset_0_1px_2px_rgba(96,110,140,0.05)]"
                    >
                      {GRADE_OPTIONS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-bold text-[#354172]">
                    1日の目標
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={form.daily_target}
                      onChange={(event) => setForm((prev) => ({ ...prev, daily_target: Number(event.target.value) || 0 }))}
                      className="mt-2 w-full rounded-[22px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172] shadow-[inset_0_1px_2px_rgba(96,110,140,0.05)]"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/80 bg-white/84 p-5">
                <h2 className="text-xl font-extrabold text-[#354172]">最初のパートナー</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {loadingOptions ? (
                    <div className="rounded-[28px] bg-[#f8fbff] px-5 py-8 text-center text-sm font-bold text-[#6f7da8] sm:col-span-3">
                      パートナーを読み込み中...
                    </div>
                  ) : (
                    starterOptions.map((option) => {
                      const imageUrl = getPokemonImage(option);
                      const active = String(selectedStarterId) === String(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedStarterId(String(option.id))}
                          className={`rounded-[28px] border p-4 text-left transition ${
                            active
                              ? 'border-[#f0c24f] bg-[#fff7d6] shadow-[0_18px_38px_rgba(240,194,79,0.18)]'
                              : 'border-[#e7eef8] bg-white/92 shadow-[0_12px_26px_rgba(145,177,209,0.10)] hover:-translate-y-0.5'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-[24px] ${active ? 'bg-white/90' : 'bg-[#eef8ff]'}`}>
                              {imageUrl ? (
                                <img src={imageUrl} alt={getPokemonName(option)} className="h-full w-full object-contain p-2" />
                              ) : (
                                <span className="text-2xl font-black text-[#354172]">{getPokemonName(option).slice(0, 1)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-lg font-black text-[#354172]">{getPokemonName(option)}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {getTypeNames(option).map((type) => (
                                  <span key={`${option.id}-${type}`} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#6f7da8]">
                                    {type}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-3 text-xs font-bold leading-5 text-[#6f7da8]">{getPokemonDescription(option)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={handleSaveProfile} className="pill-button px-7 py-4 text-base">
                {editingChildId ? '更新する' : '登録する'}
              </button>
              <button type="button" onClick={closeForm} className="ghost-button px-6 py-4 text-base">
                キャンセル
              </button>
            </div>

            {profileMessage && <div className="mt-5 rounded-[28px] bg-[#eef8ff] p-4 text-sm font-bold text-[#4f6897]">{profileMessage}</div>}
            {profileError && <div className="mt-5 rounded-[28px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{profileError}</div>}
          </motion.section>
        )}

        {!showForm && profileMessage && (
          <div className="rounded-[28px] bg-[#eef8ff] p-4 text-sm font-bold text-[#4f6897]">{profileMessage}</div>
        )}
        {!showForm && profileError && (
          <div className="rounded-[28px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{profileError}</div>
        )}
      </div>
    </div>
  );
}
