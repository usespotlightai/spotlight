export const WORDS = '[a-z0-9]+(-[a-z0-9]+)*';

export const LONGEST_WORDS = 64;

const EXACTLY_WORDS = new RegExp(`^${WORDS}$`);

export const areWords = (named: string): boolean =>
  EXACTLY_WORDS.test(named) && named.length <= LONGEST_WORDS;

export const wordsFrom = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LONGEST_WORDS)
    .replace(/-+$/g, '');

export const SECRET_NAME_SHAPE = '[A-Z][A-Z0-9_]{0,63}';
