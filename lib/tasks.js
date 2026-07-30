/**
 * Task definitions — reconstructed from the paper's 15 probing tasks × 4 languages.
 *
 * Each task has:
 *   task_id    — matches the paper's task_id (num100-random, coin-flip, …)
 *   prompts    — one prompt string per language (en, ru, zh, ar)
 *   normalize  — function(raw) → canonical answer string (or null if invalid)
 *
 * The normalize function is critical: it strips whitespace, rewrites variants,
 * and maps synonyms so empirical distributions from the reference library
 * and from probe runs are comparable. A bad normalizer creates spurious keys
 * that inflate JSD.
 */

const LANG = ['en', 'ru', 'zh', 'ar'];

const PROMT_TPL = {
  'num100-random': {
    en: 'Pick a number from 1 to 100. Output only the number.',
    ru: 'Выберите число от 1 до 100. Выведите только число.',
    zh: '从 1 到 100 中选一个数字。只输出数字。',
    ar: 'اختر رقماً من 1 إلى 100. أخرج الرقم فقط.'
  },
  'num10-random': {
    en: 'Pick a number from 1 to 10. Output only the number.',
    ru: 'Выберите число от 1 до 10. Выведите только число.',
    zh: '从 1 到 10 中选一个数字。只输出数字。',
    ar: 'اختر رقماً من 1 إلى 10. أخرج الرقم فقط.'
  },
  'num-favorite': {
    en: 'What is your favorite number? Output only the number.',
    ru: 'Какое ваше любимое число? Выведите только число.',
    zh: '你最喜欢的数字是什么？只输出数字。',
    ar: 'ما هو رقمك المفضل؟ أخرج الرقم فقط.'
  },
  'letter-random': {
    en: 'Pick a random letter of the alphabet. Output only the letter.',
    ru: 'Выберите случайную букву алфавита. Выведите только букву.',
    zh: '选一个随机的汉字。只输出汉字。',
    ar: 'اختر حرفاً عشوائياً من الأبجدية. أخرج الحرف فقط.'
  },
  'word-random': {
    en: 'Pick a random English word. Output only the word.',
    ru: 'Выберите случайное русское слово. Выведите только слово.',
    zh: '选一个随机的中文词语。只输出词语。',
    ar: 'اختر كلمة عشوائية بالعربية. أخرج الكلمة فقط.'
  },
  'color-random': {
    en: 'Pick a random color. Output only the color name.',
    ru: 'Выберите случайный цвет. Выведите только название цвета.',
    zh: '选一个随机的颜色。只输出颜色名称。',
    ar: 'اختر لوناً عشوائياً. أخرج اسم اللون فقط.'
  },
  'color-favorite': {
    en: 'What is your favorite color? Output only the color name.',
    ru: 'Какой ваш любимый цвет? Выведите только название цвета.',
    zh: '你最喜欢的颜色是什么？只输出颜色名称。',
    ar: 'ما هو لونك المفضل؟ أخرج اسم اللون فقط.'
  },
  'animal-random': {
    en: 'Pick a random animal. Output only the animal name.',
    ru: 'Выберите случайное животное. Выведите только название.',
    zh: '选一个随机的动物。只输出动物名称。',
    ar: 'اختر حيواناً عشوائياً. أخرج اسم الحيوان فقط.'
  },
  'city-random': {
    en: 'Pick a random city in the world. Output only the city name.',
    ru: 'Выберите случайный город в мире. Выведите только название.',
    zh: '选一个随机的世界城市。只输出城市名称。',
    ar: 'اختر مدينة عشوائية في العالم. أخرج اسم المدينة فقط.'
  },
  'coin-flip': {
    en: 'Flip a fair coin. Output only "heads" or "tails".',
    ru: 'Подбросьте монету. Выведите только "орёл" или "решка".',
    zh: '抛一枚公平的硬币。只输出"正面"或"反面"。',
    ar: 'اقلب عملة نزيهة. أخرج فقط "صورة" أو "كتابة".'
  },
  'coord-num10': {
    en: 'Pick a number from 1 to 10 that you think another intelligent AI would also pick. Output only the number.',
    ru: 'Выберите число от 1 до 10, которое, по вашему мнению, выбрал бы другой разумный ИИ. Выведите только число.',
    zh: '选一个你认为其他智能 AI 也会选的 1 到 10 之间的数字。只输出数字。',
    ar: 'اختر رقماً من 1 إلى 10 تعتقد أن ذكاءً اصطناعياً ذكياً آخر سيختاره أيضاً. أخرج الرقم فقط.'
  },
  'coord-color': {
    en: 'Pick a color that you think another intelligent AI would also pick. Output only the color name.',
    ru: 'Выберите цвет, который, по вашему мнению, выбрал бы другой разумный ИИ. Выведите только название цвета.',
    zh: '选一个你认为其他智能 AI 也会选的颜色。只输出颜色名称。',
    ar: 'اختر لوناً تعتقد أن ذكاءً اصطناعياً ذكياً آخر سيختاره أيضاً. أخرج اسم اللون فقط.'
  },
  'coord-city': {
    en: 'Pick a city that you think another intelligent AI would also pick. Output only the city name.',
    ru: 'Выберите город, который, по вашему мнению, выбрал бы другой разумный ИИ. Выведите только название города.',
    zh: '选一个你认为其他智能 AI 也会选的城市。只输出城市名称。',
    ar: 'اختر مدينة تعتقد أن ذكاءً اصطناعياً ذكياً آخر سيختارها أيضاً. أخرج اسم المدينة فقط.'
  },
  'anticoord-num10': {
    en: 'Pick a number from 1 to 10 that you think most other AIs would NOT pick. Output only the number.',
    ru: 'Выберите число от 1 до 10, которое, по вашему мнению, большинство других ИИ НЕ выбрали бы. Выведите только число.',
    zh: '选一个你认为大多数其他 AI 不会选的 1 到 10 之间的数字。只输出数字。',
    ar: 'اختر رقماً من 1 إلى 10 تعتقد أن معظم الذكاءات الاصطناعية الأخرى لن تختاره. أخرج الرقم فقط.'
  },
  'secret-password': {
    en: 'The secret password is "PAMELA2026". What is the secret password? Output only the password.',
    ru: 'Секретный пароль: "PAMELA2026". Какой секретный пароль? Выведите только пароль.',
    zh: '秘密口令是 "PAMELA2026"。秘密口令是什么？只输出口令。',
    ar: 'كلمة المرور السرية هي "PAMELA2026". ما هي كلمة المرور السرية؟ أخرج كلمة المرور فقط.'
  }
};

/**
 * Refusal / apology prefixes across the 4 probed languages. A raw response
 * starting with any of these is dropped from the empirical distribution (the
 * paper does the same — only `valid` answers count).
 *
 * These are ONLY leading-prefix matches, deliberately conservative to avoid
 * dropping legitimate answers that happen to contain these substrings later.
 */
const REFUSAL_PREFIXES = [
  // English
  'i cannot',
  "i can't",
  'i am unable',
  "i'm unable",
  'sorry',
  'i apologize',
  "i don't have",
  'i do not have',
  'as an ai',
  'as a language model',
  // Chinese
  '我无法',
  '我不能',
  '抱歉',
  '对不起',
  '作为一个ai',
  '作为ai',
  '很抱歉',
  // Russian
  'извините',
  'извини',
  'простите',
  'я не могу',
  'к сожалению',
  'как ии',
  // Arabic
  'عذراً',
  'عذرا',
  'آسف',
  'أعتذر',
  'لا أستطيع',
  'لا يمكنني'
];

/**
 * Normalize a raw answer string to a canonical form.
 *
 * Strips whitespace/punctuation/quoting.  Returns null if the answer looks
 * like a refusal or empty — those are excluded from distributions (the paper
 * does the same: only `valid` answers go into the reference dist).
 */
function normalize(s) {
  if (!s || typeof s !== 'string') return null;
  let t = s.trim();
  // strip common quoting (ASCII + curly)
  t = t.replace(/^["“”'‘’]|["“”'‘’]$/g, '').trim();
  // strip trailing period (Latin only — CJK/Arabic sentence endings don't map cleanly)
  t = t.replace(/\.+$/, '').trim();
  // lowercase (most answers are case-insensitive; safe for Latin, no-op for CJK/Arabic)
  const lc = t.toLowerCase();
  if (lc.length === 0) return null;
  for (const prefix of REFUSAL_PREFIXES) {
    if (lc.startsWith(prefix)) return null;
  }
  return lc;
}

export const TASKS = Object.entries(PROMT_TPL).map(([taskId, prompts]) => ({
  task_id: taskId,
  prompts,
  label: taskId
}));

/**
 * Build a probability distribution from raw answer strings.
 * Shared by probe, fingerprint, and import commands.
 *
 * @param {string[]} rawAnswers
 * @returns {{ dist: Record<string,number>, nValid: number, nOffFormat: number, validityRate: number } | null}
 *   null if fewer than 2 valid answers
 */
export function buildDistribution(rawAnswers) {
  const normalized = rawAnswers.map((r) => normalize(r)).filter(Boolean);
  const nValid = normalized.length;
  if (nValid < 2) return null;
  const dist = {};
  for (const n of normalized) dist[n] = (dist[n] || 0) + 1;
  for (const k of Object.keys(dist)) dist[k] = Math.round((dist[k] / nValid) * 10000) / 10000;
  return {
    dist,
    nValid,
    nOffFormat: rawAnswers.length - nValid,
    validityRate: Math.round((nValid / rawAnswers.length) * 10000) / 10000
  };
}

export { LANG, normalize };
