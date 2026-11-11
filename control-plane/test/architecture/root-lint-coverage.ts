import { readFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';
import { SOURCE_ROOT, sourcePaths } from './source-index';
import type { Violation } from './violation';

type BiomeOverride = {
  readonly includes?: readonly string[];
  readonly linter?: {
    readonly rules?: {
      readonly style?: { readonly noRestrictedImports?: unknown };
    };
  };
};

const IMPORT_RULE_INCLUDES: readonly (readonly string[])[] = (
  (
    JSON.parse(readFileSync(join(SOURCE_ROOT, '..', 'biome.json'), 'utf8')) as {
      overrides?: readonly BiomeOverride[];
    }
  ).overrides ?? []
)
  .filter((override) => override.linter?.rules?.style?.noRestrictedImports)
  .map((override) => override.includes ?? []);

const isIncluded = (path: string, includes: readonly string[]): boolean =>
  includes.some((glob) => !glob.startsWith('!') && matchesGlob(path, glob)) &&
  !includes.some(
    (glob) => glob.startsWith('!') && matchesGlob(path, glob.slice(1)),
  );

export const rootLintCoverageViolations = (): Violation[] =>
  sourcePaths('', { specs: true })
    .map((path) => `src/${path}`)
    .filter(
      (path) =>
        !IMPORT_RULE_INCLUDES.some((includes) => isIncluded(path, includes)),
    )
    .map((path) => ({
      key: `${path}: no import rules in biome.json`,
      at: path,
    }));
