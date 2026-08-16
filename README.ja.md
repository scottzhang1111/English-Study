<h1 align="center">⚔️ 英語クエスト · Eigo Quest</h1>

<p align="center">
  日本の子どもたちのための、ダークファンタジー英単語アドベンチャー。<br/>
  単語を学び、ステージをクリアし、ヒーローカードを集めて、ボスに挑もう — 毎日少しずつ。
</p>

<p align="center">
  <a href="README.md">English</a> · <b>日本語</b> · 📽️ <a href="docs/slides/EigoQuest_Intro_JA.pptx">紹介スライド (JA)</a> / <a href="docs/slides/EigoQuest_Intro_EN.pptx">Intro deck (EN)</a>
</p>

![UI ビジョン — コア学習フロー](docs/images/ui-vision.png)

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

## 冒険のはじまり · ホームと世界地図

子どもは自分のホームから出発し、**8つの属性ワールド**(風・火・水・雷・森・岩・影・光)を
冒険します。1ワールドは 20単語 × 10ステージ。ステージ4と8にミニボス、ステージ10には
ワールドボスが待ち受けます。ボス戦はクイズバトル — 正解するとヒーローが攻撃、不正解だと
ボスの反撃です。

| ホーム — 今日の進捗 | 世界地図 — 次のステージを選ぶ |
|:---:|:---:|
| ![ホーム](docs/images/home.png) | ![世界地図](docs/images/world-map.png) |

## 📚 単語クエスト

毎日 **20個のターゲット単語** を発音・意味・例文つきで学び、フラッシュカードで覚えて、
小テストへ。間違えた単語は記録され、次回の学習で**優先的に再出題**されます。

| 単語一覧 — 今日の20単語 | 単語詳細 — 意味・例文・覚え方 |
|:---:|:---:|
| ![単語一覧](docs/images/word-list.png) | ![単語詳細](docs/images/word-detail.png) |

## ✏️ 文法クエスト

「現在完了」などの文法は、短い講解と例文でやさしく学び、文法クイズと語形フォーム練習で
定着させます。間違えても温かいフィードバック — 罰はありません。

<p align="center"><img src="docs/images/grammar-lesson.png" width="560" alt="文法レッスン — 現在完了"/></p>

## 🧠 クイズ & AI 練習

ユニットごとの小テストで理解度をチェック。さらに **Google Gemini** による AI レイヤーが、
子どものレベルに合わせた問題の自動生成、**英検面接のAI練習とその場での採点**、
英作文のAIチェックとアドバイスを提供します。

<p align="center"><img src="docs/images/quiz.png" width="260" alt="小テスト"/></p>

## 🎓 英検対策

- **英検3級**:単語・熟語セットを収録(CSV データ同梱)
- **英検準2級**:練習セット・間違い復習・本番形式の模擬試験モード
- 間違えた問題だけを集中して復習

## 🃏 カード報酬と成長

ステージクリアやボス撃破で**ヒーローカード**を獲得。復習を続けると強化素材、英検チャレンジで
バッジがもらえます。進捗・カード・復習キューは子どもごとに完全に独立 — きょうだいで
上書きされる心配はありません。

| ステージクリア — 報酬 | ヒーローカードを集めよう |
|:---:|:---:|
| ![ステージクリア報酬](docs/images/stage-clear-banner.png) | ![ステージクリア](docs/images/stage-clear.png) |

<p align="center">
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian1.png" width="120" alt="ヒーローカード"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian2.png" width="120" alt="ヒーローカード"/>
  <img src="frontend/public/assets/eigo-quest/cards/boss/wind-mini-boss1.png" width="120" alt="ボスカード"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian3.png" width="120" alt="ヒーローカード"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian4.png" width="120" alt="ヒーローカード"/>
</p>

## 👨‍👩‍👧‍👦 家族で使える

複数の子どもプロフィール対応(進捗は完全分離)。保護者ダッシュボードと単語管理。
日本語 UI、大きなタッチターゲット、モバイルファーストのダークファンタジーデザイン。

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
├── docs/                   # 設計ドキュメント + README 用の画像・紹介スライド
│   ├── images/             # README 用アートワーク・アプリ画面
│   └── slides/             # プロジェクト紹介スライド(JA / EN)
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
