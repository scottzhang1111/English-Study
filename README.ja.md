<h1 align="center">⚔️ 英語クエスト · Eigo Quest</h1>

<p align="center">
  日本の子どもたちのための、ダークファンタジー英単語アドベンチャー。<br/>
  単語を学び、ステージをクリアし、ヒーローカードを集めて、ボスに挑もう — 毎日少しずつ。
</p>

<p align="center">
  <a href="README.md">English</a> · <b>日本語</b>
</p>

<p align="center">
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian1.png" width="130" alt="風のガーディアン"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian2.png" width="130" alt="風のガーディアン"/>
  <img src="frontend/public/assets/eigo-quest/cards/boss/wind-mini-boss1.png" width="130" alt="風のミニボス"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian3.png" width="130" alt="風のガーディアン"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian4.png" width="130" alt="風のガーディアン"/>
</p>

## コンセプト

英語クエストは「ゲーム風の見た目をつけた単語帳」ではありません。**毎日の英語学習そのものが
RPG の世界を冒険する体験になる**ように設計されています:

```text
学習       =  パワーアップ
クイズ     =  バトル
カード     =  ヒーローの仲間
ボス       =  節目のチャレンジ
ワールドマップ =  メインの進行
```

基本ループは **「20単語を学ぶ → ステージクイズをクリア → ヒーローカードを獲得 → 次のステージが
開放」**。間違えても罰はありません。苦手な単語は復習に自動で戻り、「もう一度やってみよう」という
温かい応援メッセージで次に進めます。

## 主な機能

### 🗺️ 冒険しながら学ぶ
- **8つの属性ワールド**(風・火・水・雷・森・岩・影・光)。各ワールドは 20 単語 × 10 ステージ構成
- **ボスバトル** — 正解するとヒーローがボスを攻撃、不正解だとボスの反撃。ステージ 4・8 にミニボス、
  ステージ 10 にワールドボス
- **ヒーローカードコレクション** — ステージクリア・ボス撃破・復習の継続でカードを獲得

### 📚 学習システム
- **発音・意味・例文**つきの毎日の単語ユニット
- ステージクイズで正誤を自動記録
- **苦手単語の優先復習** — 間違えた単語ほど先に出題
- 文法クエスト・文法フォーム練習と専用の復習フロー

### 🎓 英検対策
- **英検3級** 単語・熟語セット(CSV データ同梱)
- **英検準2級** 練習セット・間違い復習・本番形式の模擬試験モード
- **AI 面接練習**(スコアリング付き)と **AI 英作文チェック**(Google Gemini 使用)

### 👨‍👩‍👧‍👦 家族で使える
- 複数の子どもプロフィール対応 — 進捗・報酬・復習キューは子どもごとに完全に分離
- 保護者ダッシュボード・保護者用単語管理・ファミリー管理
- 日本語 UI、大きなタッチターゲット、モバイルファーストのダークファンタジーデザイン

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + Vite + Tailwind CSS(モバイルファースト、`frontend/`) |
| バックエンド | Flask + gunicorn(`app.py`、`/api/*` の REST API) |
| データベース | ローカル開発は SQLite · 本番は PostgreSQL(Neon/Render など) |
| AI | `google-genai` 経由の Google Gemini(問題生成・面接採点・英作文チェック) |

## はじめかた

**バックエンド**(Python 3.10+):

```bash
pip install -r requirements.txt
cp .env.example .env        # デフォルトは SQLite。Postgres は USE_POSTGRES/DATABASE_URL を設定
python app.py               # http://localhost:5000
```

**フロントエンド**(Node 18+):

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

本番では `npm run build` でフロントエンドをビルドし、Flask がビルド成果物を配信して
`/api/*` をバックエンド API として残す構成を推奨します。

## プロジェクト構成

```
├── app.py                  # Flask バックエンド:子ども・進捗・クイズ・報酬・英検・AI
├── frontend/               # React + Vite + Tailwind のモバイルアプリ
│   └── src/pages/          # ホーム・ステージマップ・ボスバトル・カード・英検・文法・保護者…
├── docs/                   # 設計ドキュメント:ゲームループ・ボスシステム・UI システム
├── data/                   # 学習コンテンツ
├── eiken*.csv              # 英検単語・熟語データセット
└── AGENTS.md               # 開発・AI エージェント向けの作業ルール(まずここを読む!)
```

最初に読むべき設計ドキュメント:`docs/EIGO_QUEST_GAME_LOOP.md`(ゲームデザイン)、
`docs/EIGO_UI_SYSTEM.md`(ビジュアル言語)、`docs/UI_COMPONENT_SYSTEM.md`(コンポーネント規約)。

## 設計方針

- 学習データの**唯一の正**はバックエンドのデータベース
- 子ども固有の API 呼び出しには必ず `childId` を付与 — 進捗が他の子どもに混ざらない
- 間違いには温かいフィードバックを。罰は与えない
- *「RPG のように感じられる学習アプリであって、たまたま英語の問題が入っているゲームではない」*

## ライセンス / 利用について

家庭内での私的利用を目的とした個人プロジェクトです。英検®および日本英語検定協会とは関係ありません。
