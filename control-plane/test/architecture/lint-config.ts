import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

const patternsOf = (setting: unknown): readonly ImportPattern[] => {
  if (!Array.isArray(setting)) {
    return [];
  }

  const options: unknown = setting[1];

  return typeof options === 'object' &&
    options !== null &&
    'patterns' in options
    ? (options.patterns as readonly ImportPattern[])
    : [];
};

export const IMPORT_OVERRIDES: readonly ImportOverride[] = (
  (
    JSON.parse(
      readFileSync(join(SOURCE_ROOT, '..', '.oxlintrc.json'), 'utf8'),
    ) as { readonly overrides?: readonly Override[] }
  ).overrides ?? []
)
  .filter((override) => override.rules?.['no-restricted-imports'])
  .map((override) => ({
    files: override.files ?? [],
    excludeFiles: override.excludeFiles ?? [],
    patterns: patternsOf(override.rules?.['no-restricted-imports']),
  }));
