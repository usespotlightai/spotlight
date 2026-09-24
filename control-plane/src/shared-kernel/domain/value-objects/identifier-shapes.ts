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

export const SOURCE_WORD = '[a-z0-9]+';

export const DOTTED_NAME = `${SOURCE_WORD}(\\.[a-z0-9][a-z0-9_-]*)+`;

const TOOL_NAME = `${WORDS}(\\.${WORDS})?`;

const EXACTLY_SOURCE_WORD = new RegExp(`^${SOURCE_WORD}$`);
const EXACTLY_DOTTED_NAME = new RegExp(`^${DOTTED_NAME}$`);
const EXACTLY_TOOL_NAME = new RegExp(`^${TOOL_NAME}$`);

export const isSourceWord = (named: string): boolean =>
  EXACTLY_SOURCE_WORD.test(named);

export const isDottedName = (named: string): boolean =>
  EXACTLY_DOTTED_NAME.test(named);

export const isToolName = (named: string): boolean =>
  EXACTLY_TOOL_NAME.test(named);

export const CATALOG = 'catalog';

export const CATALOG_VERSION =
  '(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)';

const EXACTLY_CATALOG_REFERENCE = new RegExp(
  `^${CATALOG}\\.${WORDS}@${CATALOG_VERSION}$`,
);

export const isCatalogReference = (named: string): boolean =>
  EXACTLY_CATALOG_REFERENCE.test(named) && named.length <= 128;

export const unversioned = (named: string): string =>
  named.split('@', 1)[0] ?? named;
