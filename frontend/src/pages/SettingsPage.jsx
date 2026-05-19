import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AppDashboardLayout from '../components/AppDashboardLayout';
import { useChildren } from '../ChildrenContext';
import {
  deleteChildProfile,
  getChildStarterOptions,
  saveChildProfile,
} from '../api';
import { PET_STARTER_OPTIONS } from '../lib/petMaster';
import { useThemeScheme } from '../ThemeContext';

const DEFAULT_FORM = {
  name: '',
  grade: '1',
  target_level: '三級',
  daily_target: 20,
};

const GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6'];

const THEME_OPTIONS = [
  { id: 'soft-kids', label: 'やさしい', description: 'ホームやペットに合う、やわらかい雰囲気' },
  { id: 'clean-study', label: 'すっきり', description: '単語・文法に合う、読みやすい学習向け' },
  { id: 'premium', label: 'プレミアム', description: 'レポートやWeb画面に合う、落ち着いた質感' },
  { id: 'workbook', label: '練習帳', description: '英検・復習に合う、紙面に近い集中モード' },
];

const TYPE_LABELS = {
  air: 'そら',
  dark_elec: 'やみでんき',
  elec: 'でんき',
  fire: 'ほのお',
  rock: 'いわ',
  star: 'ほし',
  water: 'みず',
  wood: 'もり',
};

function getPetImage(option) {
  return option?.image_url || option?.sprite_url || '';
}

function getPetName(option) {
  return option?.name || 'ペット';
}

function getPetDescription(option) {
  const tags = option?.tagsJa || [];
  return tags.length ? `${tags.join('・')} が得意な学習パートナーです。` : 'いっしょに英語学習を進めるパートナーです。';
}

function getTypeNames(option) {
  return (option?.types || [])
    .map((type) => TYPE_LABELS[type.name || type] || type.name || type)
    .filter(Boolean);
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [starterOptions, setStarterOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChildId, setEditingChildId] = useState(null);
  const [selectedStarterId, setSelectedStarterId] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [deleteTargetChild, setDeleteTargetChild] = useState(null);
  const [isDeletingChild, setIsDeletingChild] = useState(false);
  const { children, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();
  const { themeScheme, setThemeScheme } = useThemeScheme();

  const selectedStarter = useMemo(
    () => starterOptions.find((option) => String(option.id) === String(selectedStarterId)) || null,
    [starterOptions, selectedStarterId],
  );

  const starterById = useMemo(() => {
    const map = new Map();
    starterOptions.forEach((option) => map.set(String(option.id), option));
    return map;
  }, [starterOptions]);

  const refreshStarterOptions = async () => {
    setLoadingOptions(true);
    try {
      const payload = await Promise.race([
        getChildStarterOptions(),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('starter options timeout')), 4000)),
      ]);
      const options = payload.options?.length ? payload.options : PET_STARTER_OPTIONS;
      setStarterOptions(options);
      setSelectedStarterId((prev) => {
        if (prev && options.some((option) => String(option.id) === String(prev))) return prev;
        return options[0] ? String(options[0].id) : '';
      });
    } catch (err) {
      setStarterOptions(PET_STARTER_OPTIONS);
      setSelectedStarterId((prev) => {
        if (prev && PET_STARTER_OPTIONS.some((option) => String(option.id) === String(prev))) return prev;
        return String(PET_STARTER_OPTIONS[0].id);
      });
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
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
    setSelectedChildId(String(childId));
    navigate('/app', { replace: true });
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
        setSelectedChildId(String(nextChildId));
      }

      setProfileMessage(editingChildId ? '子どもの設定を更新しました。' : '子どもを登録しました。');
      closeForm();
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const openDeleteConfirm = (child) => {
    setProfileMessage('');
    setProfileError('');
    setDeleteTargetChild(child);
  };

  const closeDeleteConfirm = () => {
    if (isDeletingChild) return;
    setDeleteTargetChild(null);
  };

  const confirmDeleteChild = async () => {
    if (!deleteTargetChild) return;
    const childId = deleteTargetChild.id;

    setProfileMessage('');
    setProfileError('');
    setIsDeletingChild(true);
    try {
      await deleteChildProfile(childId);
      const nextChildren = await refreshChildren();
      if (String(selectedChildId) === String(childId)) {
        const nextSelected = nextChildren[0]?.id ? String(nextChildren[0].id) : '';
        setSelectedChildId(nextSelected);
      }
      if (nextChildren.length === 0) {
        setSelectedChildId('');
      }
      if (String(editingChildId) === String(childId)) {
        closeForm();
      }
      setDeleteTargetChild(null);
      setProfileMessage('子どもの設定を削除しました。');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setIsDeletingChild(false);
    }
  };

  const hasChildren = children.length > 0;
  const visibleProfileError = profileError || childrenError;

  return (
    <AppDashboardLayout title="設定" subtitle="子どもとテーマを整えます。">
      <div className="grid gap-5 lg:gap-6">
        <section className="panel px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="display-font text-2xl font-bold text-[var(--color-text)]">テーマ</h1>
              <p className="mt-1 text-sm font-semibold text-[var(--color-muted)]">画面全体の色、角丸、影、フォントを切り替えます。</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {THEME_OPTIONS.map((option) => {
              const active = themeScheme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setThemeScheme(option.id)}
                  className={`theme-option-card ${active ? 'theme-option-card-active' : ''}`}
                  aria-pressed={active}
                >
                  <span className="theme-option-swatch" />
                  <span className="mt-3 text-base font-bold">{option.label}</span>
                  <span className="mt-1 text-xs font-semibold leading-5">{option.description}</span>
                </button>
              );
            })}
          </div>
        </section>

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
                const partnerName = petOption ? getPetName(petOption) : child.partner_name || child.pet?.name || '';
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
                          onClick={() => openDeleteConfirm(child)}
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
                <div className="mt-5 grid gap-5 lg:grid-cols-3">
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
                      const imageUrl = getPetImage(option);
                      const active = String(selectedStarterId) === String(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedStarterId(String(option.id))}
                          className={`flex min-h-[430px] flex-col rounded-[28px] border p-4 text-center transition ${
                            active
                              ? 'border-[#f0c24f] bg-[#fff7d6] shadow-[0_18px_38px_rgba(240,194,79,0.18)]'
                              : 'border-[#e7eef8] bg-white/92 shadow-[0_12px_26px_rgba(145,177,209,0.10)] hover:-translate-y-0.5'
                          }`}
                        >
                          <div
                            className={`mx-auto flex h-[250px] w-[250px] max-w-full shrink-0 items-center justify-center rounded-[26px] ${
                              active
                                ? 'bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.88)_0%,rgba(255,249,220,0.68)_52%,rgba(255,239,170,0.42)_100%)]'
                                : 'bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.86)_0%,rgba(238,248,255,0.72)_58%,rgba(217,238,255,0.42)_100%)]'
                            }`}
                          >
                            {imageUrl ? (
                              <img src={imageUrl} alt={getPetName(option)} className="h-[250px] w-[250px] max-w-full bg-transparent object-contain" />
                            ) : (
                              <span className="text-2xl font-black text-[#354172]">{getPetName(option).slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="mt-4 flex min-w-0 flex-1 flex-col items-center">
                            <p className="w-full truncate text-lg font-black text-[#354172]">{getPetName(option)}</p>
                            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                              {getTypeNames(option).map((type) => (
                                <span key={`${option.id}-${type}`} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#6f7da8]">
                                  {type}
                                </span>
                              ))}
                            </div>
                            <p className="mt-3 text-xs font-bold leading-6 text-[#6f7da8]">{getPetDescription(option)}</p>
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
            {visibleProfileError && <div className="mt-5 rounded-[28px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{visibleProfileError}</div>}
          </motion.section>
        )}

        {!showForm && profileMessage && (
          <div className="rounded-[28px] bg-[#eef8ff] p-4 text-sm font-bold text-[#4f6897]">{profileMessage}</div>
        )}
        {!showForm && visibleProfileError && (
          <div className="rounded-[28px] bg-rose-50 p-4 text-sm font-bold text-rose-700">{visibleProfileError}</div>
        )}
      </div>

      {deleteTargetChild && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#dff2ff]/75 px-4 py-8 backdrop-blur-sm"
          onClick={closeDeleteConfirm}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-md rounded-[32px] border border-white/90 bg-white p-7 text-center shadow-[0_24px_70px_rgba(103,148,191,0.22)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-child-title"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-3xl">
              🗑️
            </div>
            <h2 id="delete-child-title" className="mt-5 text-2xl font-extrabold text-[#354172]">
              {deleteTargetChild.name} を削除しますか？
            </h2>
            <p className="mt-4 text-sm font-bold leading-7 text-[#6f7da8]">
              この子どもの学習データも削除されます。あとから元に戻せません。
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={isDeletingChild}
                className="rounded-full border border-[#d9e8f8] bg-white px-5 py-3 text-sm font-black text-[#61759e] shadow-[0_8px_20px_rgba(103,148,191,0.10)] transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDeleteChild}
                disabled={isDeletingChild}
                className="rounded-full border border-rose-200 bg-gradient-to-b from-rose-300 to-rose-500 px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(244,63,94,0.24)] transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {isDeletingChild ? '削除中...' : '削除する'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AppDashboardLayout>
  );
}


