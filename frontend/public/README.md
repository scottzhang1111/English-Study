# Eigo World Login UI Assets

Recommended destination in your project:

```text
frontend/public/assets/eigo-quest/login/
```

## Core files

```text
login-logo.png
login-panel-frame.png
login-button-gold.png
login-input-frame.png
login-info-panel.png
```

## Optional decoration files

```text
divider-ornament.png
separator-line-long.png
separator-ornate.png
separator-thin.png
gem-large.png
gem-medium.png
gem-small.png
corner-left.png
corner-right.png
flourish-left.png
flourish-center.png
flourish-small.png
```

## Implementation note

Use the images as frames/ornaments only. Keep these texts as HTML/CSS so they stay editable:

```text
保護者ログイン
家族で英語学習をはじめましょう
メールアドレス
メールアドレスを入力
ログイン / 新規登録
はじめての方もメールアドレスだけで始められます
お子さまの学習データは 保護者アカウントで管理されます
```

Do not use localStorage for token/account_id. Keep auth via HttpOnly session cookie.
