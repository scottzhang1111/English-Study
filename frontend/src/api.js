import { addPartnerExp, getPartnerExp } from './utils/dailyLearningStorage';
import { addChild, getChildren as getLocalChildren, getCurrentChild, setCurrentChildId, updateChild } from './utils/childStorage';
import { loadDailyWords, loadQuizSets, loadWordBank, readLocalJson, toDailyWord, writeLocalJson } from './lib/staticData';
import { getChildVocabProgress, updateWordProgress } from './utils/vocabProgressStorage';

const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'static';

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeWord(word) {
  return {
    id: word.id,
    word: word.word,
    jp: word.jp || word.meaningJa || '',
    cn: word.cn || word.meaningZh || '',
    category: word.category || word.partOfSpeech || '',
    example: word.example || word.exampleEn || '',
    example_jp: word.example_jp || word.exampleJa || '',
    example_cn: word.example_cn || word.exampleZh || '',
    example_short: word.example || word.exampleEn || '',
    phrase: word.phrase || '',
    importance: word.importance || '',
    frequency_in_test: word.frequency_in_test || word.frequency || '',
    synonyms: word.synonyms || '',
    synonyms_japanese: word.synonyms_japanese || word.synonymsJa || '',
    antonyms: word.antonyms || '',
    antonyms_japanese: word.antonyms_japanese || word.antonymsJa || '',
  };
}

async function getWords() {
  const payload = await loadWordBank();
  return (payload.words || []).map(normalizeWord);
}

function getMasteredKey(childId) {
  return `masteredWords:${childId || 'default'}`;
}

function getWrongKey(childId) {
  return `wrongWords:${childId || 'default'}`;
}

function splitTerms(value) {
  return String(value || '')
    .split(/[;,/、，；]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export const getHomeData = async (childId) => {
  const words = await getWords();
  const activeChild = childId ? null : getCurrentChild();
  const activeChildId = childId || activeChild?.id || 'default';
  const mastered = readLocalJson(getMasteredKey(activeChildId), []);
  const partnerExp = getPartnerExp(activeChildId);
  return {
    progress: mastered.length,
    target: 20,
    remain: Math.max(0, 20 - mastered.length),
    total_words: words.length,
    mastered_words: mastered.length,
    study_days: mastered.length > 0 ? 1 : 0,
    pet: {
      pokemon_id: 25,
      name: 'Pikachu',
      level: 1,
      exp: partnerExp % 100,
      max_exp: 100,
      total_exp: partnerExp,
      image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
    },
  };
};

export const getFlashcardData = async ({ word, importance, frequency } = {}) => {
  let words = await getWords();
  if (importance && importance !== 'ALL') {
    words = words.filter((item) => item.importance === importance);
  }
  if (frequency && frequency !== 'ALL') {
    words = words.filter((item) => item.frequency_in_test === frequency);
  }
  const selected = word
    ? words.find((item) => item.word.toLowerCase() === word.toLowerCase() || String(item.id) === String(word))
    : pickRandom(words);
  const item = selected || words[0];
  return { ...item, sentence_jp: item.example_jp };
};

export const getDailyWords = async (limit = 20) => {
  const payload = await loadWordBank();
  const words = (payload.words || []).map(toDailyWord);
  const limitedWords = Number.isFinite(Number(limit)) ? words.slice(0, Number(limit)) : words;
  return {
    targetWordCount: Number(payload.targetWordCount || 20),
    words: limitedWords,
  };
};

export const markMastered = async ({ word, childId, vocabId }) => {
  const key = getMasteredKey(childId);
  const mastered = readLocalJson(key, []);
  const id = String(vocabId || word || '');
  const next = mastered.includes(id) ? mastered : [...mastered, id];
  writeLocalJson(key, next);
  return { progress: next.length, target: 20, remain: Math.max(0, 20 - next.length), mastered_words: next };
};

export const addPokemonExp = async (childId, expAmount) => ({
  pet: { total_exp: addPartnerExp(childId, expAmount), exp: expAmount, max_exp: 100, level: 1 },
  pet_exp_awarded: expAmount,
});

export const getQuizData = async ({ word } = {}) => {
  const words = await getWords();
  const item = word ? words.find((entry) => entry.word === word) || pickRandom(words) : pickRandom(words);
  const choices = shuffle([item.word, ...shuffle(words.filter((entry) => entry.id !== item.id)).slice(0, 3).map((entry) => entry.word)]);
  return {
    question: `「${item.jp}」は英語でどれ？`,
    choices,
    correct: item.word,
    word: item.word,
    id: item.id,
    japanese: item.jp,
    example: item.example,
    example_jp: item.example_jp,
    mastered_count: readLocalJson(getMasteredKey('default'), []).length,
    error_count: 0,
    review_mode: 'static_words',
  };
};

export const getVocabExpansionQuestion = async (mode = 'synonym') => {
  const words = await getWords();
  const requestedMode = mode === 'antonym' ? 'antonym' : 'synonym';
  const key = requestedMode === 'synonym' ? 'synonyms' : 'antonyms';
  const candidates = words.filter((word) => splitTerms(word[key]).length > 0);
  const item = pickRandom(candidates.length ? candidates : words);
  const correct = pickRandom(splitTerms(item[key]).length ? splitTerms(item[key]) : [item.word]);
  const pool = words.flatMap((word) => [...splitTerms(word.synonyms), ...splitTerms(word.antonyms)]).filter((term) => term !== correct);
  return {
    id: item.id,
    word: item.word,
    mode: requestedMode,
    question: `Choose the best ${requestedMode} for "${item.word}".`,
    choices: shuffle([correct, ...shuffle(pool).slice(0, 3)]),
    correct,
    japanese: item.jp,
    chinese: item.cn,
    example: item.example,
    example_jp: item.example_jp,
    phrase: item.phrase,
    synonyms: splitTerms(item.synonyms),
    synonyms_japanese: item.synonyms_japanese,
    antonyms: splitTerms(item.antonyms),
    antonyms_japanese: item.antonyms_japanese,
  };
};

export const submitVocabExpansionAnswer = async ({ id, selected, correct, childId }) => {
  const isCorrect = selected === correct;
  if (!isCorrect) {
    const wrong = readLocalJson(getWrongKey(childId), []);
    writeLocalJson(getWrongKey(childId), [...wrong, id]);
    const current = childId ? getChildVocabProgress(childId)[String(id)] : null;
    updateWordProgress(childId, id, {
      wrongCount: Number(current?.wrongCount || 0) + 1,
      familiarity: Math.max(0, Number(current?.familiarity || 0) - 1),
      needsReview: true,
    });
  }
  return { correct: isCorrect, correct_answer: correct, selected, pet_exp_awarded: isCorrect ? 5 : 0 };
};

export const getTodayReviewQuiz = async () => {
  const payload = await loadQuizSets();
  return { questions: payload.review || [] };
};

export const getAiPracticeQuestion = async () => {
  const quiz = await getQuizData();
  return { question: { ...quiz, question_type: 'multiple_choice' } };
};

export const submitAiPracticeAnswer = async ({ selectedAnswer }) => ({ correct: Boolean(selectedAnswer), explanation: 'Static mode result.' });

export const startBattle = async () => ({ session_id: `static_${Date.now()}`, question: await getQuizData(), monster: null });
export const submitBattleAnswer = async () => ({ correct: true, explanation: 'Static mode battle answer.' });
export const captureBattleMonster = async () => ({ captured: true });
export const getBattleMonsters = async () => ({
  monsters: [
    {
      id: 'comparison_cat',
      nameJa: 'くらべキャット',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/300.png',
      grammarCategory: 'comparison',
      captured: true,
      level: 1,
      exp: 0,
      grammarTip: '比較のポイントを確認しよう。',
    },
  ],
});
export const getBattleWrongQuestions = async () => ({ questions: [] });
export const masterBattleWrongQuestion = async () => ({ mastered: true });

export const getEikenQuestions = async () => {
  const payload = await loadQuizSets();
  return { questions: payload.eiken || [], source: 'static', warning: '' };
};

export const getEikenPre2Sets = async () => ({ sets: [] });
export const getEikenPre2Set = async (setId) => ({ set_id: setId, questions: [] });
export const submitEikenPre2Attempt = async (payload) => ({ ...payload, saved: true });
export const startEikenPre2Attempt = async () => ({ attempt_id: `static_${Date.now()}`, questions: [] });
export const submitEikenPre2Answer = async () => ({ saved: true });
export const completeEikenPre2Attempt = async () => ({ completed: true });
export const getEikenPre2Attempt = async () => ({ attempt: null, answers: [] });
export const getEikenPre2WrongQuestions = async () => ({ wrong_answers: [] });

export const submitPracticeAnswer = async ({ id, word, selected, correct, childId }) => {
  const isCorrect = String(selected).toLowerCase() === String(correct).toLowerCase();
  const progress = childId ? getChildVocabProgress(childId)[String(id || word)] : null;
  if (isCorrect) {
    await markMastered({ word, childId, vocabId: id });
    updateWordProgress(childId, id || word, {
      correctCount: Number(progress?.correctCount || 0) + 1,
      familiarity: Math.min(5, Number(progress?.familiarity || 0) + 1),
    });
  } else {
    const wrong = readLocalJson(getWrongKey(childId), []);
    writeLocalJson(getWrongKey(childId), [...wrong, id || word]);
    updateWordProgress(childId, id || word, {
      wrongCount: Number(progress?.wrongCount || 0) + 1,
      familiarity: Math.max(0, Number(progress?.familiarity || 0) - 1),
      needsReview: true,
    });
  }
  return { correct: isCorrect, correct_answer: correct, id, selected, pet_exp_awarded: isCorrect ? 10 : 0 };
};

export const getReviewList = async () => {
  const words = await getWords();
  const child = getCurrentChild();
  const childId = child?.id || 'default';
  const progress = getChildVocabProgress(childId);
  const progressItems = Object.values(progress)
    .filter((item) => item?.needsReview || Number(item?.wrongCount || 0) > 0)
    .sort((a, b) => Number(b.wrongCount || 0) - Number(a.wrongCount || 0) || Number(a.familiarity || 0) - Number(b.familiarity || 0));
  const progressIds = progressItems.map((item) => item.wordId);
  const wrongIds = [...progressIds, ...readLocalJson(getWrongKey(childId), [])];
  const uniqueWrongIds = Array.from(new Set(wrongIds.map(String))).filter(Boolean);
  return {
    review_list: uniqueWrongIds.map((id) => {
      const word = words.find((item) => String(item.id) === String(id)) || words[0];
      const itemProgress = progress[String(id)] || {};
      return {
        word_id: id,
        id: word.id,
        word: word.word,
        japanese: word.jp,
        example_japanese: word.example_jp,
        error_count: Number(itemProgress.wrongCount || 1),
        familiarity: Number(itemProgress.familiarity || 0),
      };
    }),
  };
};

export const getPetsData = async () => ({
  child: null,
  pets: [
    {
      pokemon_id: 1,
      name: 'フシギダネ',
      level: 1,
      exp: 0,
      max_exp: 100,
      exp_progress: 0,
      total_exp: 0,
      unlocked: true,
      image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png',
    },
  ],
  current_pet: {
    pokemon_id: 1,
    name: 'フシギダネ',
    level: 1,
    exp: 0,
    max_exp: 100,
    exp_progress: 0,
    total_exp: 0,
    unlocked: true,
    image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png',
  },
  owned_count: 1,
  total_count: 151,
  reward_status: { today_progress: 0, today_target: 20, today_progress_percent: 0, next_unlock_exp: 20, has_locked_pokemon: true },
});

export const getPetRoomData = async () => ({ pets: [] });
export const getPetLevelData = async () => ({ pet: null });
export const getProgressData = async () => ({ daily: [], summary: {} });
export const getChildStats = async () => ({ child: null, today: {}, total_studied_words: 0, top_wrong_words: [] });
export const getLearnedWords = async (childId) => {
  const words = await getWords();
  const mastered = readLocalJson(getMasteredKey(childId), []);
  return { child: null, count: mastered.length, words: words.filter((word) => mastered.includes(String(word.id))) };
};

export const getChildren = async () => ({
  children: getLocalChildren().map((child) => ({
    id: child.id,
    name: child.name,
    grade: child.grade,
    target_level: child.targetLevel,
    daily_target: 20,
    starter_pokemon_id: 1,
  })),
});

export const getChildStarterOptions = async () => ({
  options: [
    { id: 4, name: 'ヒトカゲ', image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png', sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png', types: [{ name: 'fire' }] },
    { id: 7, name: 'ゼニガメ', image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png', sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png', types: [{ name: 'water' }] },
    { id: 1, name: 'フシギダネ', image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png', sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', types: [{ name: 'grass' }] },
  ],
});

export const saveChildProfile = async (payload) => {
  const existing = getLocalChildren().find((child) => child.id === payload.id);
  const child = existing
    ? updateChild(existing.id, { name: payload.name, grade: payload.grade, targetLevel: payload.target_level })
    : addChild({ name: payload.name, grade: payload.grade, targetLevel: payload.target_level, partnerMonsterId: 'bulbasaur' });
  setCurrentChildId(child.id);
  return { child };
};

export const deleteChildProfile = async (childId) => {
  const children = getLocalChildren().filter((child) => String(child.id) !== String(childId));
  localStorage.setItem('children', JSON.stringify(children));
  return { deleted: true, child_id: childId };
};

export const getSettings = async () => readLocalJson('settings', { daily_target: 20 });
export const saveSettings = async (dailyTarget) => {
  const settings = { daily_target: Number(dailyTarget || 20) };
  writeLocalJson('settings', settings);
  return settings;
};

export { DATA_MODE };
