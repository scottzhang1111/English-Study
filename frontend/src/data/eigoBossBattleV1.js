export const EIGO_BOSS_BATTLE_COVER = "/assets/eigo-quest/cards/back/wind-cover.png";

export const FIRST_BOSS_BATTLE = {
  id: "wind_trial_001",
  title: "風の試練",
  subtitle: "風の守護者たちと、風裂きハーピィに挑もう！",
  world: "wind",
  stage: 4,
  playerHp: 100,
  boss: {
    id: "wind_mini_boss_1",
    name: "風裂きハーピィ",
    title: "第一の風妖",
    hp: 120,
    image: "/assets/eigo-quest/cards/boss/wind-mini-boss1.png",
    bannerImage: "/assets/eigo-quest/cards/boss/wind-mini-boss1.png",
    bannerObjectPosition: "center 32%",
    aura: {
      primary: "rgba(255, 25, 91, 0.34)",
      secondary: "rgba(88, 14, 64, 0.48)",
      shadow: "rgba(142, 9, 54, 0.24)"
    },
    dangerLabel: "弱点露出！"
  },
  heroes: [
    {
      id: "wind_guardian_1",
      name: "風の守護者 1",
      image: "/assets/eigo-quest/cards/wind/wind-guardian1.png",
      attack: 20
    },
    {
      id: "wind_guardian_2",
      name: "風の守護者 2",
      image: "/assets/eigo-quest/cards/wind/wind-guardian2.png",
      attack: 20
    },
    {
      id: "wind_guardian_3",
      name: "風の守護者 3",
      image: "/assets/eigo-quest/cards/wind/wind-guardian3.png",
      attack: 20
    },
    {
      id: "wind_guardian_4",
      name: "風の守護者 4",
      image: "/assets/eigo-quest/cards/wind/wind-guardian4.png",
      attack: 20
    }
  ]
};

export const FIRST_BOSS_QUESTIONS = [
  {
    id: "q1",
    prompt: "「風」は英語でどれ？",
    choices: ["wind", "water", "fire", "stone"],
    answer: "wind"
  },
  {
    id: "q2",
    prompt: "I can ___ fast.",
    choices: ["run", "runs", "running", "ran"],
    answer: "run"
  },
  {
    id: "q3",
    prompt: "Choose the correct meaning of “strong”.",
    choices: ["強い", "小さい", "遅い", "寒い"],
    answer: "強い"
  },
  {
    id: "q4",
    prompt: "She ___ English every day.",
    choices: ["studies", "study", "studying", "studied"],
    answer: "studies"
  },
  {
    id: "q5",
    prompt: "Which word means 「速い」?",
    choices: ["fast", "slow", "heavy", "quiet"],
    answer: "fast"
  },
  {
    id: "q6",
    prompt: "We ___ soccer after school.",
    choices: ["play", "plays", "playing", "played"],
    answer: "play"
  },
  {
    id: "q7",
    prompt: "Choose the correct word: This book is very ___.",
    choices: ["interesting", "interest", "interests", "interested"],
    answer: "interesting"
  },
  {
    id: "q8",
    prompt: "「毎日」は英語でどれ？",
    choices: ["every day", "yesterday", "tomorrow", "last week"],
    answer: "every day"
  }
];

export const FIRST_BOSS_REWARD = {
  source: "wind_trial_001",
  rewardTitle: "風の試練クリア報酬",
  nextPath: "/card-reward?source=wind_trial_001"
};
