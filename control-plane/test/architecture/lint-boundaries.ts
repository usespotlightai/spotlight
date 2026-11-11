import { reachableFrom } from './context-dependencies';
import {
  IMPORT_OVERRIDES,
  type ImportOverride,
  type ImportPattern,
} from './lint-config';
import { CONTEXTS } from './source-index';

const BOUNDARY = /^Context boundary: .*may depend on ([^.]*)\./;

const contextOfOverride = (override: ImportOverride): string | null =>
  /^src\/contexts\/([^/]+)\//.exec(override.files[0] ?? '')?.[1] ?? null;

const boundariesOf = (override: ImportOverride): ImportPattern[] =>
  override.patterns.filter((pattern) => BOUNDARY.test(pattern.message));

const forbiddenBy = (pattern: ImportPattern): ReadonlySet<string> =>
  new Set(
    pattern.group.flatMap((glob) => /^@([a-z-]+)\/\*\*$/.exec(glob)?.[1] ?? []),
  );

export const lintBoundaryProblems = (): string[] =>
  IMPORT_OVERRIDES.flatMap((override) => {
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
      const where = override.files.join(', ');
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
      !IMPORT_OVERRIDES.some(
        (override) =>
          override.files[0] === `src/contexts/${context}/**` &&
          boundariesOf(override).length > 0,
      ),
  );
