import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthMe, getChildren } from '../api';
import { useAuth } from '../AuthContext';
import { useChildren } from '../ChildrenContext';

const SOCIAL_LOGIN_OPTIONS = [
  { label: 'Appleで続ける', mark: 'Apple' },
  { label: 'Googleで続ける', mark: 'G' },
  { label: 'LINEで続ける', mark: 'LINE' },
];

export default function ParentLoginPage() {
  const navigate = useNavigate();
  const { login, authLoading } = useAuth();
  const { setSelectedChildId } = useChildren();
  const [email, setEmail] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [codeNotice, setCodeNotice] = useState('');
  const [formError, setFormError] = useState('');

  const handleCodeSend = () => {
    setCodeNotice('管理者から受け取ったファミリーコードを入力してください。');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedCode = familyCode.trim();
    if (!trimmedEmail && !trimmedCode) {
      setFormError('メールアドレスまたはファミリーコードを入力してください。');
      return;
    }

    setFormError('');
    try {
      await login(trimmedCode ? { code: trimmedCode } : { email: trimmedEmail });
    } catch (err) {
      setFormError(err.message || 'ログインできませんでした。');
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
      setFormError(err.message || '子どもプロフィールを確認できませんでした。');
    }
  };

  return (
    <main className="parent-login-page">
      <div className="parent-login-page__overlay" aria-hidden="true" />
      <section className="parent-login-shell" aria-labelledby="parent-login-title">
        <div className="parent-login-titleplate" aria-label="Eigo World">
          <img src="/assets/eigo-quest/ui/app-logo.png" alt="" aria-hidden="true" />
          <span>Eigo World</span>
        </div>

        <header className="parent-login-hero">
          <h1 id="parent-login-title">保護者ログイン</h1>
          <p>まずは保護者の方がログインしてください</p>
        </header>

        <form className="parent-login-card" onSubmit={handleSubmit}>
          <label className="parent-login-field">
            <span>メールアドレス / 電話番号</span>
            <span className="parent-login-input">
              <span aria-hidden="true">✉</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="メールアドレス / 電話番号"
              />
            </span>
          </label>

          <label className="parent-login-field">
            <span>認証コード</span>
            <span className="parent-login-code-row">
              <span className="parent-login-input">
                <span aria-hidden="true">◇</span>
                <input
                  type="text"
                  value={familyCode}
                  onChange={(event) => setFamilyCode(event.target.value)}
                  autoComplete="one-time-code"
                  placeholder="ファミリーコード"
                />
              </span>
              <button type="button" className="parent-login-code-button" onClick={handleCodeSend}>
                送信
              </button>
            </span>
          </label>

          <p className="parent-login-hint">※ファミリーコードまたはメールアドレスでログインできます</p>
          {(codeNotice || formError) && (
            <p className={`parent-login-message ${formError ? 'is-error' : ''}`}>
              {formError || codeNotice}
            </p>
          )}

          <button type="submit" className="parent-login-main-button" disabled={authLoading}>
            {authLoading ? 'ログイン中...' : 'ログイン / 新規登録'}
          </button>

          <div className="parent-login-divider">
            <span>または、他の方法で続ける</span>
          </div>

          <div className="parent-login-social-list">
            {SOCIAL_LOGIN_OPTIONS.map((option) => (
              <button type="button" className="parent-login-social-button" disabled key={option.label}>
                <span className={`parent-login-social-mark is-${option.mark.toLowerCase()}`}>{option.mark}</span>
                <strong>{option.label}</strong>
                <em>準備中</em>
              </button>
            ))}
          </div>
        </form>

        <footer className="parent-login-footer">
          <span aria-hidden="true">☆</span>
          <p>
            お子さまの学習データは
            <br />
            保護者アカウントで管理されます
          </p>
        </footer>
      </section>
    </main>
  );
}
