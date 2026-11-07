import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reachableFrom } from './context-dependencies';
import { CONTEXTS, SOURCE_ROOT } from './source-index';

type Pattern = { readonly group: readonly string[]; readonly message: string };

type BiomeOverride = {
  readonly includes?: readonly string[];
  readonly linter?: {
    readonly rules?: {
      readonly style?: {
        readonly noRestrictedImports?: {
          readonly options?: { readonly patterns?: readonly Pattern[] };
        };
      };
    };
  };
};

const OVERRIDES: readonly BiomeOverride[] =
  (
    JSON.parse(readFileSync(join(SOURCE_ROOT, '..', 'biome.json'), 'utf8')) as {
      overrides?: readonly BiomeOverride[];
    }
  ).overrides ?? [];

const BOUNDARY = /^Context boundary: .*may depend on ([^.]*)\./;

const contextOfOverride = (override: BiomeOverride): string | null =>
  /^src\/contexts\/([^/]+)\//.exec(override.includes?.[0] ?? '')?.[1] ?? null;

const boundariesOf = (override: BiomeOverride): Pattern[] =>
  (
    override.linter?.rules?.style?.noRestrictedImports?.options?.patterns ?? []
  ).filter((pattern) => BOUNDARY.test(pattern.message));

const forbiddenBy = (pattern: Pattern): ReadonlySet<string> =>
  new Set(
    pattern.group.flatMap((glob) => /^@([a-z-]+)\/\*\*$/.exec(glob)?.[1] ?? []),
  );

export const biomeBoundaryProblems = (): string[] =>
  OVERRIDES.flatMap((override) => {
    const context = contextOfOverride(override);

    if (!context) {
      return [];
    }

    const reached = reachableFrom(context);

    return boundariesOf(override).flatMap((pattern) => {
      const forbidden = forbiddenBy(pattern);
      const allowed = CONTEXTS.filter(
        (other) => other !== context && !forbidden.has(other),
      );
      const where = override.includes?.join(', ');
      const looser = allowed
        .filter((other) => !reached.has(other))
        .map(
          (other) =>
            `${where}: lets ${context} import ${other}, which is not upstream`,
        );
      const said = (BOUNDARY.exec(pattern.message)?.[1] ?? '')
        .split(', ')
        .filter((each) => each !== 'no other context')
        .sort();
      const message =
        said.join(',') === allowed.join(',')
          ? []
          : [`${where}: the message names ${said.join(', ') || 'no context'}`];

      return [...looser, ...message];
    });
  });

export const contextsWithoutBoundary = (): string[] =>
  CONTEXTS.filter(
    (context) =>
      !OVERRIDES.some(
        (override) =>
          override.includes?.[0] === `src/contexts/${context}/**` &&
          boundariesOf(override).length > 0,
      ),
  );
