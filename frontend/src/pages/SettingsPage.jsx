import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import HeaderBar from '../components/HeaderBar';
import PetDisplay from '../components/PetDisplay';
import {
  deleteChildProfile,
  getChildStarterOptions,
  getChildren,
  getSettings,
  saveChildProfile,
  saveSettings,
} from '../api';

const DEFAULT_FORM = {
  name: '',
  grade: '1',
  target_level: '3級',
  daily_target: 20,
};

const GRADE_OPTIONS = ['1', '2', '3', '4', '5', '6'];
const TARGET_OPTIONS = ['3級', '準2級'];
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

const partnerLines = [
  'いっしょに、少しずつ進もう。',
  'きょうもよく来たね。',
  'その調子。いい流れだよ。',
  'ここからもうひと押しだね。',
];

function getPokemonImage(option) {
  return option?.image_url || option?.sprite_url || '';
}

function normalizeTargetLevel(value) {
  return TARGET_OPTIONS.includes(value) ? value : '3級';
}

export default function SettingsPage() {
  const [dailyTarget, setDailyTarget] = useState(20);
  const [dailyMessage, setDailyMessage] = useState('');
  const [dailyError, setDailyError] = useState(null);
  const [children, setChildren] = useState([]);
  const [starterOptions, setStarterOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [profileMessage, setProfileMessage] = useState('');
  const [selectedStarterId, setSelectedStarterId] = useState('');
  const [editingChildId, setEditingChildId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [partnerLineIndex, setPartnerLineIndex] = useState(0);

  const selectedStarter = useMemo(
    () => starterOptions.find((option) => String(option.id) === String(selectedStarterId)) || null,
    [starterOptions, selectedStarterId],
  );

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
        if (prev && options.some((option) => String(option.id) === String(prev))) {
          return prev;
        }
        return options[0] ? String(options[0].id) : '';
      });
    } catch (err) {
      setStarterOptions(DEFAULT_STARTER_OPTIONS);
      setSelectedStarterId((prev) => {
        if (prev && DEFAULT_STARTER_OPTIONS.some((option) => String(option.id) === String(prev))) {
          return prev;
        }
        return String(DEFAULT_STARTER_OPTIONS[0].id);
      });
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    getSettings()
      .then((data) => setDailyTarget(Number(data.daily_target || 20)))
      .catch((err) => setDailyError(err.message));

    refreshChildren().catch((err) => setProfileError(err.message));
    refreshStarterOptions().catch((err) => setProfileError(err.message));
  }, []);

  const beginEditChild = (child) => {
    setEditingChildId(child.id);
    setForm({
      name: child.name || '',
      grade: child.grade || '1',
      target_level: normalizeTargetLevel(child.target_level),
      daily_target: Number(child.daily_target || 20),
    });
    if (child.starter_pokemon_id) {
      setSelectedStarterId(String(child.starter_pokemon_id));
    } else if (starterOptions[0]) {
      setSelectedStarterId(String(starterOptions[0].id));
    }
    setPartnerLineIndex(0);
    setProfileMessage('');
    setProfileError('');
  };

  const resetForm = () => {
    setEditingChildId(null);
    setForm({ ...DEFAULT_FORM });
    if (starterOptions[0]) {
      setSelectedStarterId(String(starterOptions[0].id));
    }
    setPartnerLineIndex(0);
    setProfileMessage('');
    setProfileError('');
  };

  const handleSaveDailyTarget = async () => {
    setDailyMessage('');
    setDailyError(null);
    try {
      const result = await saveSettings(dailyTarget);
      setDailyTarget(Number(result.daily_target || dailyTarget));
      setDailyMessage('1日の学習基準を保存しました。');
    } catch (err) {
      setDailyError(err.message);
    }
  };

  const handleSaveProfile = async () => {
    setProfileMessage('');
    setProfileError(null);
    try {
      if (!form.name.trim()) {
        throw new Error('名前を入力してください。');
      }
      if (!selectedStarterId) {
        throw new Error('初期Pokemonを選んでください。');
      }

      const payload = await saveChildProfile({
        id: editingChildId ?? undefined,
        name: form.name.trim(),
        grade: form.grade,
        target_level: form.target_level,
        daily_target: Number(form.daily_target || 20),
        starter_pokemon_id: Number(selectedStarterId),
      });

      const childrenList = await refreshChildren();
      if (payload?.child?.id) {
        localStorage.setItem(CHILD_STORAGE_KEY, String(payload.child.id));
      } else if (childrenList[0]?.id) {
        localStorage.setItem(CHILD_STORAGE_KEY, String(childrenList[0].id));
      }

      setProfileMessage(editingChildId ? 'プロフィールを更新しました。' : 'プロフィールを登録しました。');
      resetForm();
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const handleDeleteChild = async (childId) => {
    const child = children.find((item) => String(item.id) === String(childId));
    if (!child) return;
    if (!window.confirm(`${child.name} を削除しますか？`)) return;

    setProfileMessage('');
    setProfileError(null);
    try {
      await deleteChildProfile(childId);
      const nextChildren = await refreshChildren();
      const stored = localStorage.getItem(CHILD_STORAGE_KEY);
      if (String(stored) === String(childId)) {
        const nextSelected = nextChildren[0]?.id ? String(nextChildren[0].id) : '';
        if (nextSelected) {
          localStorage.setItem(CHILD_STORAGE_KEY, nextSelected);
        } else {
          localStorage.removeItem(CHILD_STORAGE_KEY);
        }
      }
      if (String(editingChildId) === String(childId)) {
        resetForm();
      }
      setProfileMessage('プロフィールを削除しました。');
    } catch (err) {
      setProfileError(err.message);
    }
  };

  const currentBubble = partnerLines[partnerLineIndex % partnerLines.length];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="子ども設定" />

      <div className="grid gap-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-[#6f7da8]">学習の確認</p>
              <h2 className="display-font mt-1 text-2xl font-extrabold text-[#354172]">
                学習統計と進捗
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5f6f94]">
                子どものプロフィール設定といっしょに、学習状況を確認できます。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.location.assign('/app/child-stats')}
                className="hidden"
              >
                学習統計
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/app/progress')}
                className="pill-button px-5 py-3"
              >
                進捗
              </button>
            </div>
          </div>
        </motion.section>
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[40px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(243,248,255,0.9)_100%)] px-6 py-6 shadow-[0_18px_44px_rgba(145,177,209,0.16)]"
        >
          <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
            基本資料
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[40px] border border-white/80 bg-white/82 p-6 shadow-[0_14px_34px_rgba(145,177,209,0.12)]">
              <h2 className="display-font text-2xl font-extrabold text-[#354172]">子どもの基本情報を入力してください</h2>
              <p className="mt-2 text-sm leading-6 text-[#5f6f94]">
                名前、学年、目標、毎日の学習量をここでまとめて設定します。
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                  目標
                  <select
                    value={form.target_level}
                    onChange={(event) => setForm((prev) => ({ ...prev, target_level: event.target.value }))}
                    className="mt-2 w-full rounded-[22px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172] shadow-[inset_0_1px_2px_rgba(96,110,140,0.05)]"
                  >
                    {TARGET_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold text-[#354172]">
                  1日の学習量
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

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={handleSaveProfile} className="pill-button px-6 py-3 text-[1rem] shadow-[0_10px_0_rgba(170,120,0,0.95),0_18px_30px_rgba(255,191,31,0.34)]">
                  {editingChildId ? '更新' : '登録'}
                </button>
                <button type="button" onClick={resetForm} className="ghost-button px-6 py-3 text-[1rem]">
                  リセット
                </button>
              </div>

              {profileMessage && <div className="mt-4 rounded-[32px] bg-[#eef8ff] p-4 text-sm font-bold text-[#4f6897]">{profileMessage}</div>}
              {profileError && <div className="mt-4 rounded-[32px] bg-rose-50 p-4 text-sm text-rose-700">{profileError}</div>}
            </div>

            <div className="rounded-[40px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(246,250,255,0.92)_100%)] p-5 shadow-[0_14px_34px_rgba(145,177,209,0.12)]">
              <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
                初期の相棒
              </div>
              <p className="mt-3 text-sm leading-6 text-[#5f6f94]">
                初期の相棒を選びます。タップすると下の相棒がその姿に切り替わります。
              </p>

              <div className="mt-5 rounded-[36px] border border-white/80 bg-white/86 p-4 shadow-[0_16px_36px_rgba(145,177,209,0.12)]">
                <button
                  type="button"
                  onClick={() => setPartnerLineIndex((prev) => prev + 1)}
                  className="w-full rounded-[34px] text-left transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <PetDisplay
                    pet={
                      selectedStarter
                        ? {
                            ...selectedStarter,
                            level: 1,
                            exp: 0,
                            total_exp: 0,
                            max_exp: 100,
                          }
                        : null
                    }
                    showDetails={false}
                    enableEffects
                    bubbleText={currentBubble}
                    className="shadow-[0_24px_52px_rgba(145,177,209,0.22)]"
                  />
                </button>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPartnerLineIndex((prev) => prev + 1)}
                    className="rounded-full bg-[#fff7d6] px-4 py-2 text-sm font-black text-[#6b5a2d] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                  >
                    声をかける
                  </button>
                  <div className="inline-flex rounded-full bg-[#f8fbff] px-4 py-2 text-xs font-bold text-[#6f7da8]">
                    {selectedStarter ? selectedStarter.name : '未選択'}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#6f7da8]">初期Pokemon</p>
                    <p className="mt-1 text-sm text-[#6f7da8]">3つの候補から一番気に入った相棒を選びます。</p>
                  </div>
                  {selectedStarter && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#fff7d6] px-4 py-2 text-xs font-black text-[#69557e] shadow-[0_8px_18px_rgba(240,194,79,0.12)]">
                      <span className="h-2 w-2 rounded-full bg-[#f0c24f]" />
                      <span>選択中</span>
                      <span>{selectedStarter.name}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {loadingOptions ? (
                    <div className="rounded-[32px] bg-[#f8fbff] px-5 py-8 text-center text-sm text-[#6f7da8] sm:col-span-3">
                      Pokemon を読み込み中...
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
                          className={`group rounded-[34px] border p-4 text-center transition duration-200 ${
                            active
                              ? 'border-[#f0c24f] bg-[#fff7d6] shadow-[0_18px_38px_rgba(240,194,79,0.18)] ring-1 ring-[#f0c24f]/40 -translate-y-0.5'
                              : 'border-[#e7eef8] bg-white/92 shadow-[0_12px_26px_rgba(145,177,209,0.10)] hover:-translate-y-0.5 hover:border-[#d7e4f5] hover:shadow-[0_16px_30px_rgba(145,177,209,0.14)]'
                          }`}
                        >
                          <div className={`mx-auto flex h-30 w-30 items-center justify-center overflow-hidden rounded-[30px] border ${active ? 'border-white/70 bg-white/90' : 'border-white/70 bg-[#eef8ff]'}`}>
                            {imageUrl ? (
                              <img src={imageUrl} alt={option.name} className="h-full w-full object-contain p-2" />
                            ) : (
                              <div className="text-2xl font-black text-[#354172]">{option.name?.slice(0, 1)}</div>
                            )}
                          </div>
                          <p className={`mt-4 truncate text-[1.1rem] font-black leading-tight ${active ? 'text-[#32406a]' : 'text-[#3a4a78]'}`}>
                            {option.name}
                          </p>
                          <div className="mt-3 flex flex-wrap justify-center gap-2">
                            {(option.types || []).map((type) => (
                              <span
                                key={`${option.id}-${type.name || type}`}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  active ? 'bg-white/85 text-[#6f7da8]' : 'bg-[#f8fbff] text-[#6f7da8]'
                                }`}
                              >
                                {type.name || type}
                              </span>
                            ))}
                          </div>
                          <div
                            className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black ${
                              active ? 'bg-white/90 text-[#6b5a2d]' : 'bg-[#f7fbff] text-[#6f7da8]'
                            }`}
                          >
                            {active ? '選択中' : '選ぶ'}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[40px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(243,248,255,0.92)_100%)] px-6 py-6 shadow-[0_18px_44px_rgba(145,177,209,0.16)]"
        >
          <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
            安全設定
          </div>
          <h2 className="display-font mt-4 text-2xl font-extrabold text-[#354172]">登録済みの子どもを管理する</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6f94]">
            編集、切替、削除をここにまとめています。使う頻度は低いので、少し控えめな見た目にしています。
          </p>

          <div className="mt-6 grid gap-3">
            {children.length === 0 ? (
              <div className="rounded-[34px] bg-[#f8fbff] px-5 py-8 text-center text-sm text-[#6f7da8]">
                まだ子どもが登録されていません。
              </div>
            ) : (
              children.map((child) => {
                const isEditing = String(editingChildId) === String(child.id);
                const isSelected = String(localStorage.getItem(CHILD_STORAGE_KEY) || '') === String(child.id);
                return (
                  <div
                    key={child.id}
                    className={`rounded-[34px] border px-5 py-4 shadow-[0_12px_28px_rgba(145,177,209,0.10)] ${
                      isEditing ? 'border-[#f0c24f] bg-[#fff8d9]' : 'border-white/80 bg-white/86'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-lg font-extrabold text-[#354172]">{child.name}</p>
                        <p className="mt-1 text-xs font-bold text-[#94a2c5]">
                          学年 {child.grade} / 目標 {child.target_level} / 1日 {child.daily_target || 20} 語
                        </p>
                      </div>
                      {isSelected && (
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#6f7da8]">
                          現在の子ども
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => localStorage.setItem(CHILD_STORAGE_KEY, String(child.id))}
                        className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#6f7da8] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                      >
                        切替
                      </button>
                      <button
                        type="button"
                        onClick={() => beginEditChild(child)}
                        className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#6f7da8] transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteChild(child.id)}
                        className="rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 transition-all hover:-translate-y-0.5 active:scale-[0.99]"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
