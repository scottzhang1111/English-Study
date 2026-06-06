import { Link } from 'react-router-dom';

export default function OnboardingPage() {
  return (
    <main className="login-entry-page">
      <div className="login-entry-bg" aria-hidden="true" />
      <div className="login-entry-overlay" aria-hidden="true" />

      <section className="login-entry-shell" aria-labelledby="login-entry-title">
        <div className="login-entry-logo-plaque" aria-label="EIGO QUEST">
          <span className="login-entry-gem" aria-hidden="true" />
          <strong>EIGO QUEST</strong>
        </div>

        <div className="login-entry-card">
          <span className="login-entry-card-gem" aria-hidden="true" />
          <h1 id="login-entry-title" className="login-entry-title">
            はじめましょう
          </h1>
          <span className="login-entry-divider" aria-hidden="true" />
          <p className="login-entry-copy">
            保護者アカウントでログインして、
            <br />
            学習を続けます。
          </p>
          <Link to="/parent-login" className="login-entry-button">
            ログインへ
          </Link>
        </div>
      </section>
    </main>
  );
}
