import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsedAs } from '../support/body';
import { SOURCE_ROOT } from './source-index';

export type ImportPattern = {
  readonly group: readonly string[];
  readonly message: string;
};

type Override = {
  readonly files?: readonly string[];
  readonly excludeFiles?: readonly string[];
  readonly rules?: Readonly<Record<string, unknown>>;
};

export type ImportOverride = {
  readonly files: readonly string[];
  readonly excludeFiles: readonly string[];
  readonly patterns: readonly ImportPattern[];
};

const isImportPattern = (value: unknown): value is ImportPattern =>
  typeof value === 'object' &&
  value !== null &&
  'group' in value &&
  Array.isArray(value.group) &&
  'message' in value &&
  typeof value.message === 'string';

const patternsOf = (setting: unknown): readonly ImportPattern[] => {
  if (!Array.isArray(setting)) {
    return [];
  }

  const options: unknown = setting[1];

  return typeof options === 'object' &&
    options !== null &&
    'patterns' in options &&
    Array.isArray(options.patterns)
    ? options.patterns.filter(isImportPattern)
    : [];
};

export const IMPORT_OVERRIDES: readonly ImportOverride[] = (
  parsedAs<{ readonly overrides?: readonly Override[] }>(
    readFileSync(join(SOURCE_ROOT, '..', '.oxlintrc.json'), 'utf8'),
  ).overrides ?? []
)
  .filter((override) => Boolean(override.rules?.['no-restricted-imports']))
  .map((override) => ({
    files: override.files ?? [],
    excludeFiles: override.excludeFiles ?? [],
    patterns: patternsOf(override.rules?.['no-restricted-imports']),
  }));
