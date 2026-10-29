// On-screen strings by language. The game hands over its table,
// `{ it: {...}, en: {...} }`; a string is either text or a function of the
// values it shows. The first language is the fallback for missing keys.

export function createI18n(table) {
  const languages = Object.keys(table);
  const base = table[languages[0]];
  const cache = {};
  return {
    languages,
    // The browser's language if the game has it, else the first one.
    defaultLanguage() {
      const nav = (globalThis.navigator && navigator.language || '').slice(0, 2).toLowerCase();
      return languages.includes(nav) ? nav : languages[0];
    },
    strings(lang) {
      if (!cache[lang]) cache[lang] = { ...base, ...(table[lang] || {}) };
      return cache[lang];
    },
  };
}

// Picks the right language from a `{ it, en }` value; plain strings pass
// through. Handy for names kept next to content (levels, items).
export function pick(value, lang) {
  if (value == null || typeof value !== 'object') return value;
  return value[lang] ?? Object.values(value)[0];
}
