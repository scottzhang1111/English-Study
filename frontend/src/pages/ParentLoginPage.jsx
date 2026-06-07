import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthMe, getChildren } from '../api';
import { useAuth } from '../AuthContext';
import { useChildren } from '../ChildrenContext';
import { useBgm } from '../context/BgmContext';

export default function ParentLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authLoading } = useAuth();
  const { setSelectedChildId } = useChildren();
  const { soundEnabled, setSoundEnabled, startBgm } = useBgm();
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [pageNotice, setPageNotice] = useState(location.state?.message || '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    startBgm();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError('メールアドレスを入力してください');
      return;
    }

    setFormError('');
    setPageNotice('');
    try {
      await login({ email: trimmedEmail });
    } catch (err) {
      setFormError('ログインできませんでした');
      return;
    }

    try {
      await getAuthMe();
    } catch (err) {
      setFormError('ログイン状態を確認できませんでした');
      return;
    }

    try {
      const payload = await getChildren();
      const childList = payload.children || [];
      if (childList.length === 0) {
        setSelectedChildId('');
        navigate('/create-child-profile', { replace: true });
        return;
      }
      setSelectedChildId(childList[0].id);
      navigate('/app', { replace: true });
    } catch (err) {
      setFormError('子どもプロフィールを確認できませんでした');
    }
  };

  return (
    <main className="parent-login-page">
      <div className="parent-login-page__overlay" aria-hidden="true" />
      <section className="parent-login-shell" aria-labelledby="parent-login-title">
        <header className="parent-login-hero">
          <h2 className="parent-login-world-title">Eigo World</h2>
          <p className="parent-login-world-subtitle">家族で英語学習をはじめよう</p>
        </header>

        <form className="parent-login-card" onSubmit={handleSubmit}>
          <span className="parent-login-gem" aria-hidden="true" />
          <div className="parent-login-card-heading">
            <h1 id="parent-login-title">保護者ログイン</h1>
            <p>家族で英語学習をはじめましょう</p>
          </div>

          <label className="parent-login-sound-toggle">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => setSoundEnabled(event.target.checked)}
            />
            <span aria-hidden="true" />
            <strong>BGMを鳴らす</strong>
          </label>

          <label className="parent-login-field">
            <span>メールアドレス</span>
            <span className="parent-login-input">
              <span aria-hidden="true">✉</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="メールアドレスを入力"
              />
            </span>
          </label>

          {(pageNotice || formError) && (
            <p className={`parent-login-message ${formError ? 'is-error' : ''}`}>
              {formError || pageNotice}
            </p>
          )}

          <button type="submit" className="parent-login-main-button" disabled={authLoading}>
            {authLoading ? 'ログイン中...' : 'ログイン / 新規登録'}
          </button>

          <p className="parent-login-hint">
            はじめての方もメールアドレスだけで始められます
          </p>

          <div className="parent-login-note-card">
            <span className="parent-login-shield" aria-hidden="true">♜</span>
            <p>
              お子さまの学習データは
              <br />
              保護者アカウントで管理されます
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
