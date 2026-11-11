import { matchesGlob } from 'node:path';

import { IMPORT_OVERRIDES, type ImportOverride } from './lint-config';
import { sourcePaths } from './source-index';
import type { Violation } from './violation';

const isIncluded = (path: string, override: ImportOverride): boolean =>
  override.files.some((glob) => matchesGlob(path, glob)) &&
  !override.excludeFiles.some((glob) => matchesGlob(path, glob));

export const rootLintCoverageViolations = (): Violation[] =>
  sourcePaths('', { specs: true })
    .map((path) => `src/${path}`)
    .filter(
      (path) =>
        !IMPORT_OVERRIDES.some((override) => isIncluded(path, override)),
    )
    .map((path) => ({
      key: `${path}: no import rules in .oxlintrc.json`,
      at: path,
    }));
