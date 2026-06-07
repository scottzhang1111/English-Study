import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveChildProfile } from '../api';
import { useChildren } from '../ChildrenContext';

const CHILD_ICON_BASE = '/assets/eigo-quest/child icon';
const CHILD_ICONS = [1, 2, 3, 4, 5, 6].map((number) => ({
  id: `child${number}`,
  src: `${CHILD_ICON_BASE}/child${number}.png`,
}));

const DEFAULT_AVATAR = `${CHILD_ICON_BASE}/child4.png`;
const DEFAULT_LEARNING_GOAL = 'eiken_pre2';
const DEFAULT_DAILY_TARGET = 20;

const LEARNING_GOALS = [
  { value: 'eiken3', label: '英検3級をめざす' },
  { value: 'eiken_pre2', label: '英検準2級をめざす' },
];

const DAILY_TARGETS = [
  { value: 10, label: '10問', disabled: true },
  { value: 15, label: '15問', disabled: true },
  { value: 20, label: '20問', disabled: false, note: '毎日20問' },
];

function resolveChildAvatar(child) {
  const avatar = child?.avatar || '';
  return avatar.startsWith('/assets/') ? avatar : DEFAULT_AVATAR;
}

export default function CreateChildProfilePage() {
  const navigate = useNavigate();
  const { children, setSelectedChildId, refreshChildren } = useChildren();
  const [existingChildren, setExistingChildren] = useState(children || []);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [learningGoal, setLearningGoal] = useState(DEFAULT_LEARNING_GOAL);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    refreshChildren({ force: true }).then((list) => {
      if (isMounted) {
        setExistingChildren(list || []);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [refreshChildren]);

  const isAddMode = existingChildren.length > 0;
  const pageCopy = useMemo(() => ({
    eyebrow: isAddMode ? 'ADD PROFILE' : 'FIRST PROFILE',
    title: isAddMode ? '子どもプロフィールを追加' : '最初の子どもプロフィール',
    subtitle: isAddMode ? '新しく学習する子どもを登録しましょう' : 'はじめに学習する子どもを登録しましょう',
    button: isAddMode ? 'この子を追加' : 'この子でスタート',
  }), [isAddMode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('ニックネームを入力してください。');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const result = await saveChildProfile({
        nickname: trimmedNickname,
        avatar,
        learning_goal: learningGoal,
        grade: learningGoal,
        daily_target: DEFAULT_DAILY_TARGET,
        daily_word_target: DEFAULT_DAILY_TARGET,
      });
      const childId = result?.child?.id;
      await refreshChildren({ force: true });
      if (childId) {
        setSelectedChildId(childId);
      }
      navigate('/app', { replace: true });
    } catch (err) {
      if (err.status === 401) {
        navigate('/parent-login', { replace: true });
        return;
      }
      setError(err.message || 'プロフィールを作成できませんでした。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="create-child-profile-page">
      <div className="create-child-profile-bg" aria-hidden="true" />
      <div className="create-child-profile-overlay" aria-hidden="true" />

      <form className="create-child-profile-card" onSubmit={handleSubmit}>
        <span className="create-child-profile-card-gem" aria-hidden="true" />
        <header className="create-child-profile-header">
          <p>{pageCopy.eyebrow}</p>
          <h1>{pageCopy.title}</h1>
          <span>{pageCopy.subtitle}</span>
        </header>

        {isAddMode ? (
          <section className="create-child-profile-existing" aria-label="登録中の子ども">
            <h2>登録中の子ども</h2>
            <div className="create-child-profile-existing-grid">
              {existingChildren.map((child) => (
                <article className="create-child-profile-existing-card" key={child.id}>
                  <img src={resolveChildAvatar(child)} alt="" />
                  <strong>{child.nickname || child.name}</strong>
                </article>
              ))}
              <article className="create-child-profile-existing-card is-add">
                <span aria-hidden="true">+</span>
                <strong>新しく追加</strong>
              </article>
            </div>
          </section>
        ) : null}

        <section className="create-child-profile-section is-icons" aria-label="アイコンをえらぶ">
          <h2>アイコンをえらぶ</h2>
          <div className="create-child-profile-icon-grid">
            {CHILD_ICONS.map((icon) => {
              const selected = icon.src === avatar;
              return (
                <button
                  key={icon.id}
                  type="button"
                  className={selected ? 'is-selected' : ''}
                  onClick={() => setAvatar(icon.src)}
                  aria-pressed={selected}
                >
                  <img src={icon.src} alt="" />
                  {selected ? <span aria-hidden="true">✓</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <label className="create-child-profile-field">
          <span>ニックネーム</span>
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="三宝" />
        </label>

        <section className="create-child-profile-section" aria-label="学習目標">
          <h2>学習目標</h2>
          <div className="create-child-profile-option-grid is-learning">
            {LEARNING_GOALS.map((goal) => {
              const selected = goal.value === learningGoal;
              return (
                <button
                  key={goal.value}
                  type="button"
                  className={selected ? 'is-selected' : ''}
                  onClick={() => setLearningGoal(goal.value)}
                  aria-pressed={selected}
                >
                  <span aria-hidden="true">{selected ? '✓' : ''}</span>
                  {goal.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="create-child-profile-section" aria-label="1日の目標">
          <h2>1日の目標</h2>
          <div className="create-child-profile-option-grid is-daily">
            {DAILY_TARGETS.map((target) => {
              const selected = target.value === DEFAULT_DAILY_TARGET;
              return (
                <button
                  key={target.value}
                  type="button"
                  className={`${selected ? 'is-selected' : ''} ${target.disabled ? 'is-disabled' : ''}`}
                  disabled={target.disabled}
                  aria-pressed={selected}
                >
                  <span aria-hidden="true">{selected ? '✓' : '◆'}</span>
                  <strong>{target.label}</strong>
                  {target.disabled ? <em>準備中</em> : <small>{target.note}</small>}
                  {target.disabled ? <b aria-hidden="true">🔒</b> : null}
                </button>
              );
            })}
          </div>
          <p className="create-child-profile-daily-copy">✦ 毎日20問をクリアしよう ✦</p>
        </section>

        {error ? <p className="create-child-profile-error">{error}</p> : null}

        <button type="submit" className="create-child-profile-main-button" disabled={isSubmitting}>
          {isSubmitting ? '作成中...' : pageCopy.button}
        </button>
        <p className="create-child-profile-footer">あとで切り替えできます</p>
      </form>
    </main>
  );
}
