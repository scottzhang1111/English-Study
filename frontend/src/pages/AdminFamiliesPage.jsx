import { useCallback, useEffect, useState } from 'react';
import { createAdminFamily, disableAdminFamilyCode, getAdminFamilies } from '../api';

const ADMIN_CODE_STORAGE_KEY = 'eq_admin_code';

const createInitialChild = () => ({
  name: '',
  grade: '4',
  target_level: '準2級',
});

function buildShareText(familyCode) {
  return `英語学習アプリのログインコードです。\n\nファミリーコード：\n${familyCode}\n\nログイン画面でこのコードを入力してください。`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function AdminFamiliesPage() {
  const [adminCode, setAdminCode] = useState(() => {
    try {
      return sessionStorage.getItem(ADMIN_CODE_STORAGE_KEY) || '';
    } catch (err) {
      return '';
    }
  });
  const [familyName, setFamilyName] = useState('');
  const [children, setChildren] = useState([createInitialChild()]);
  const [families, setFamilies] = useState([]);
  const [createdFamily, setCreatedFamily] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const saveAdminCode = useCallback((value) => {
    setAdminCode(value);
    try {
      if (value) {
        sessionStorage.setItem(ADMIN_CODE_STORAGE_KEY, value);
      } else {
        sessionStorage.removeItem(ADMIN_CODE_STORAGE_KEY);
      }
    } catch (err) {
      // Ignore restricted storage modes.
    }
  }, []);

  const loadFamilies = useCallback(async () => {
    if (!adminCode.trim()) {
      setError('管理者コードを入力してください。');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const payload = await getAdminFamilies(adminCode.trim());
      setFamilies(payload.families || []);
      setMessage('家庭一覧を更新しました。');
    } catch (err) {
      setError(err.message || '家庭一覧を取得できませんでした。');
    } finally {
      setIsLoading(false);
    }
  }, [adminCode]);

  useEffect(() => {
    if (adminCode.trim()) {
      loadFamilies();
    }
  }, []);

  const updateChild = (index, field, value) => {
    setChildren((current) => current.map((child, childIndex) => (
      childIndex === index ? { ...child, [field]: value } : child
    )));
  };

  const addChild = () => {
    setChildren((current) => [...current, createInitialChild()]);
  };

  const removeChild = (index) => {
    setChildren((current) => current.length > 1 ? current.filter((_, childIndex) => childIndex !== index) : current);
  };

  const handleCreateFamily = async (event) => {
    event.preventDefault();
    const trimmedAdminCode = adminCode.trim();
    const trimmedFamilyName = familyName.trim();
    const validChildren = children
      .map((child) => ({
        name: child.name.trim(),
        grade: child.grade.trim(),
        target_level: child.target_level.trim(),
      }))
      .filter((child) => child.name);

    if (!trimmedAdminCode) {
      setError('管理者コードを入力してください。');
      return;
    }
    if (!trimmedFamilyName) {
      setError('家庭名を入力してください。');
      return;
    }
    if (validChildren.length === 0) {
      setError('子どもを1人以上入力してください。');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const payload = await createAdminFamily(trimmedAdminCode, {
        familyName: trimmedFamilyName,
        children: validChildren,
      });
      setCreatedFamily(payload.family);
      setFamilyName('');
      setChildren([createInitialChild()]);
      setMessage('ファミリーコードを生成しました。');
      await loadFamilies();
    } catch (err) {
      setError(err.message || '家庭を作成できませんでした。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (text, successMessage) => {
    try {
      await copyText(text);
      setMessage(successMessage);
      setError('');
    } catch (err) {
      setError('コピーできませんでした。');
    }
  };

  const handleDisable = async (codeId) => {
    if (!adminCode.trim()) {
      setError('管理者コードを入力してください。');
      return;
    }
    setError('');
    try {
      await disableAdminFamilyCode(adminCode.trim(), codeId);
      setMessage('ファミリーコードを無効化しました。');
      await loadFamilies();
    } catch (err) {
      setError(err.message || '無効化できませんでした。');
    }
  };

  return (
    <main className="admin-families-page">
      <div className="admin-families-overlay" aria-hidden="true" />
      <section className="admin-families-shell">
        <header className="admin-families-header">
          <span className="admin-families-badge">ADMIN</span>
          <h1>Family Code 管理</h1>
          <p>家庭を作成して、ログイン用ファミリーコードを発行します。</p>
        </header>

        <section className="admin-families-panel">
          <label className="admin-families-field">
            <span>管理者コード</span>
            <input
              type="password"
              value={adminCode}
              onChange={(event) => saveAdminCode(event.target.value)}
              placeholder="ADMIN_CODE"
            />
          </label>
          <button type="button" className="admin-families-secondary" onClick={loadFamilies} disabled={isLoading}>
            {isLoading ? '読み込み中...' : '家庭一覧を読み込む'}
          </button>
        </section>

        <form className="admin-families-panel" onSubmit={handleCreateFamily}>
          <h2>新しい家庭</h2>
          <label className="admin-families-field">
            <span>家庭名</span>
            <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="Tanaka Family" />
          </label>

          <div className="admin-families-children">
            {children.map((child, index) => (
              <div className="admin-families-child-row" key={index}>
                <label>
                  <span>name</span>
                  <input value={child.name} onChange={(event) => updateChild(index, 'name', event.target.value)} placeholder="Aoi" />
                </label>
                <label>
                  <span>grade</span>
                  <input value={child.grade} onChange={(event) => updateChild(index, 'grade', event.target.value)} placeholder="4" />
                </label>
                <label>
                  <span>target_level</span>
                  <input value={child.target_level} onChange={(event) => updateChild(index, 'target_level', event.target.value)} placeholder="準2級" />
                </label>
                <button type="button" onClick={() => removeChild(index)} aria-label="子どもを削除">
                  ×
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="admin-families-secondary" onClick={addChild}>
            + 子どもを追加
          </button>
          <button type="submit" className="admin-families-primary" disabled={isSubmitting}>
            {isSubmitting ? '生成中...' : 'ファミリーコードを生成'}
          </button>
        </form>

        {(error || message) && (
          <p className={`admin-families-message ${error ? 'is-error' : ''}`}>{error || message}</p>
        )}

        {createdFamily ? (
          <section className="admin-families-panel admin-families-result">
            <h2>生成結果</h2>
            <strong>{createdFamily.familyName}</strong>
            <code>{createdFamily.familyCode}</code>
            <p>{(createdFamily.children || []).map((child) => child.name || child.nickname).filter(Boolean).join(' / ')}</p>
            <div className="admin-families-actions">
              <button type="button" onClick={() => handleCopy(createdFamily.familyCode, 'コードをコピーしました。')}>コピー</button>
              <button type="button" onClick={() => handleCopy(buildShareText(createdFamily.familyCode), '共有文面をコピーしました。')}>
                LINE / メール用文面をコピー
              </button>
            </div>
          </section>
        ) : null}

        <section className="admin-families-panel">
          <h2>家庭一覧</h2>
          <div className="admin-families-list">
            {families.length === 0 ? (
              <p className="admin-families-empty">まだ家庭がありません。</p>
            ) : families.map((family) => (
              <article className="admin-families-card" key={family.codeId}>
                <div>
                  <strong>{family.familyName}</strong>
                  <code>{family.familyCode}</code>
                  <span className={family.isActive ? 'is-active' : 'is-inactive'}>
                    {family.isActive ? 'active' : 'inactive'}
                  </span>
                </div>
                <p>{(family.children || []).map((child) => child.name || child.nickname).filter(Boolean).join(' / ') || '子ども未登録'}</p>
                <div className="admin-families-actions">
                  <button type="button" onClick={() => handleCopy(family.familyCode, 'コードをコピーしました。')}>コピー</button>
                  <button type="button" onClick={() => handleDisable(family.codeId)} disabled={!family.isActive}>無効化</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
