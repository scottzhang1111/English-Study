import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveChildProfile } from '../api';
import { useChildren } from '../ChildrenContext';

const LEARNING_GOALS = ['はじめて英語', '英検5級をめざす', '英検4級をめざす'];
const DAILY_TARGETS = [10, 20, 30];
const DEFAULT_AVATAR = 'child-default';

export default function CreateChildProfilePage() {
  const navigate = useNavigate();
  const { setSelectedChildId, refreshChildren } = useChildren();
  const [nickname, setNickname] = useState('大宝');
  const [learningGoal, setLearningGoal] = useState('英検4級をめざす');
  const [dailyWordTarget, setDailyWordTarget] = useState(20);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        avatar: DEFAULT_AVATAR,
        learning_goal: learningGoal,
        daily_word_target: dailyWordTarget,
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
          <p>First Profile</p>
          <h1>最初の子どもプロフィール</h1>
          <span>はじめに学習する子どもを登録しましょう</span>
        </header>

        <div className="create-child-profile-avatar-wrap">
          <div className="create-child-profile-avatar" aria-label="default child avatar">
            <span aria-hidden="true">大</span>
            <b aria-hidden="true">+</b>
          </div>
          <small>第一版はデフォルト头像を使用します</small>
        </div>

        <label className="create-child-profile-field">
          <span>ニックネーム</span>
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="大宝" />
        </label>

        <section className="create-child-profile-section" aria-label="学習目標">
          <h2>学習目標</h2>
          <div className="create-child-profile-option-grid">
            {LEARNING_GOALS.map((goal) => (
              <button
                key={goal}
                type="button"
                className={goal === learningGoal ? 'is-selected' : ''}
                onClick={() => setLearningGoal(goal)}
              >
                {goal}
              </button>
            ))}
          </div>
        </section>

        <section className="create-child-profile-section" aria-label="1日の目標">
          <h2>1日の目標</h2>
          <div className="create-child-profile-option-grid is-three">
            {DAILY_TARGETS.map((target) => (
              <button
                key={target}
                type="button"
                className={target === dailyWordTarget ? 'is-selected' : ''}
                onClick={() => setDailyWordTarget(target)}
              >
                {target}語
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="create-child-profile-error">{error}</p> : null}

        <button type="submit" className="create-child-profile-main-button" disabled={isSubmitting}>
          {isSubmitting ? '作成中...' : 'この子でスタート'}
        </button>
        <p className="create-child-profile-footer">あとで追加できます</p>
      </form>
    </main>
  );
}
