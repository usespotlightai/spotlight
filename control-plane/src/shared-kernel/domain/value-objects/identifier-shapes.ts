export const SLUG_SHAPE = '[a-z0-9]+(-[a-z0-9]+)*';

export const MAX_SLUG_LENGTH = 64;

const EXACTLY_SLUG = new RegExp(`^${SLUG_SHAPE}$`);

export const isSlug = (named: string): boolean =>
  EXACTLY_SLUG.test(named) && named.length <= MAX_SLUG_LENGTH;

export const slugify = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

export const SECRET_NAME_SHAPE = '[A-Z][A-Z0-9_]{0,63}';

export const INTEGRATION_KEY_SHAPE = '[a-z0-9]+';

export const DOTTED_NAME = `${INTEGRATION_KEY_SHAPE}(\\.[a-z0-9][a-z0-9_-]*)+`;

const TOOL_NAME = `${SLUG_SHAPE}(\\.${SLUG_SHAPE})?`;

const EXACTLY_INTEGRATION_KEY = new RegExp(`^${INTEGRATION_KEY_SHAPE}$`);
const EXACTLY_DOTTED_NAME = new RegExp(`^${DOTTED_NAME}$`);
const EXACTLY_TOOL_NAME = new RegExp(`^${TOOL_NAME}$`);

export const isIntegrationKey = (named: string): boolean =>
  EXACTLY_INTEGRATION_KEY.test(named);

export const isDottedName = (named: string): boolean =>
  EXACTLY_DOTTED_NAME.test(named);

export const isToolName = (named: string): boolean =>
  EXACTLY_TOOL_NAME.test(named);

export const CATALOG_INTEGRATION = 'catalog';

export const CATALOG_VERSION =
  '(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)';

const EXACTLY_CATALOG_REFERENCE = new RegExp(
  `^${CATALOG_INTEGRATION}\\.${SLUG_SHAPE}@${CATALOG_VERSION}$`,
);

export const isCatalogReference = (named: string): boolean =>
  EXACTLY_CATALOG_REFERENCE.test(named) && named.length <= 128;

export const catalogReferenceParts = (
  reference: string,
): { readonly name: string; readonly version: string } => {
  const [name = '', version = ''] = reference
    .slice(CATALOG_INTEGRATION.length + 1)
    .split('@');

  return { name, version };
};

export const unversioned = (named: string): string =>
  named.split('@', 1)[0] ?? named;

export const INPUT_NAME = '[A-Za-z_][A-Za-z0-9_-]{0,63}';

export const WHOLE_CALL_INPUT = 'json';
