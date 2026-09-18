import type { CodeReadingPort } from '@change-review/application/ports/code-reading.port';
import type { FileClass } from '@change-review/domain/services/diff-facts';

const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'go.sum',
  'Cargo.lock',
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock',
  'Gemfile.lock',
  'composer.lock',
]);

const GENERATED = [
  /(^|\/)(dist|build|generated|__generated__)\//,
  /\.gen\.[cm]?[jt]sx?$/,
  /\.pb\.go$/,
  /_pb2\.py$/,
  /\.min\.(js|css)$/,
  /(^|\/)meta\/(\d+_snapshot|_journal)\.json$/,
  /(^|\/)openapi\.json$/,
];

const MIGRATIONS = [
  /(^|\/)migrations?\//,
  /(^|\/)drizzle\/[^/]+\.sql$/,
  /(^|\/)alembic\/versions\//,
  /(^|\/)db\/migrate\//,
];

const CONFIGS = [
  /(^|\/)(package\.json|go\.mod|Cargo\.toml|pyproject\.toml|Gemfile|composer\.json)$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)(biome|\.eslintrc|\.prettierrc|renovate|turbo|nx)[^/]*\.(json|js|cjs|yml|yaml)$/,
  /(^|\/)[^/]+\.config\.[cm]?[jt]s$/,
  /(^|\/)\.env(\.[\w-]+)?$/,
  /(^|\/)(Dockerfile[^/]*|[^/]*compose[^/]*\.ya?ml|Makefile)$/,
  /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/,
];

const TESTS = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /_test\.go$/,
  /(^|\/)test_[^/]+\.py$/,
  /_test\.py$/,
  /(^|\/)(__tests__|tests?)\//,
];

const LEAST_DEFINITION = 3;

const IGNORED = new Set(
  (
    'abstract as async await break case catch class const constructor continue debugger declare default ' +
    'delete do else enum export extends false finally for from function get if implements import in ' +
    'instanceof interface let new null of package private protected public readonly return set static ' +
    'super switch this throw true try type typeof undefined var void while with yield ' +
    'def elif except lambda nonlocal pass raise self None True False func go chan defer map range struct ' +
    'args body children className config context data describe error event expect file files handler ' +
    'id index init input it item items key main name next options output params path props render ' +
    'request response result state test value values'
  ).split(' '),
);

const LANGUAGES: readonly {
  readonly extensions: RegExp;
  readonly definitions: readonly RegExp[];
  readonly imports: readonly RegExp[];
}[] = [
  {
    extensions: /\.[cm]?[jt]sx?$/,
    definitions: [
      /\b(?:function\*?|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/g,
      /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/g,
      /^\s*(?:(?:public|private|protected|static|async|readonly|override|get|set)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::[^{=]*)?\{/g,
    ],
    imports: [
      /\bfrom\s+['"]([^'"]+)['"]/g,
      /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
      /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    ],
  },
  {
    extensions: /\.go$/,
    definitions: [
      /\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/g,
      /\btype\s+([A-Za-z_]\w*)/g,
      /^\s*(?:var|const)\s+([A-Za-z_]\w*)/g,
    ],
    imports: [],
  },
  {
    extensions: /\.py$/,
    definitions: [/\b(?:def|class)\s+([A-Za-z_]\w*)/g, /^([A-Za-z_]\w*)\s*=/g],
    imports: [/^\s*from\s+([\w.]+)\s+import/g, /^\s*import\s+([\w.]+)/g],
  },
  {
    extensions: /\.sql$/i,
    definitions: [
      /\bcreate\s+(?:table|view|type|index)\s+(?:if\s+not\s+exists\s+)?"?(?:\w+"?\.)?"?(\w+)/gi,
    ],
    imports: [],
  },
];

const languageOf = (path: string) =>
  LANGUAGES.find(({ extensions }) => extensions.test(path)) ?? null;

const matchesIn = (
  lines: readonly string[],
  patterns: readonly RegExp[],
): string[] =>
  lines.flatMap((line) =>
    patterns.flatMap((pattern) =>
      [...line.matchAll(pattern)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      ),
    ),
  );

export class PatternCodeReading implements CodeReadingPort {
  classOf(path: string): FileClass {
    const name = path.split('/').pop() ?? path;

    if (LOCKFILES.has(name)) {
      return 'lockfile';
    }
    if (/(^|\/)__snapshots__\/|\.snap$/.test(path)) {
      return 'snapshot';
    }
    if (GENERATED.some((pattern) => pattern.test(path))) {
      return 'generated';
    }
    if (MIGRATIONS.some((pattern) => pattern.test(path))) {
      return 'migration';
    }
    if (TESTS.some((pattern) => pattern.test(path))) {
      return 'test';
    }
    if (CONFIGS.some((pattern) => pattern.test(path))) {
      return 'config';
    }
    if (/\.(md|mdx|rst|txt)$/i.test(path)) {
      return 'docs';
    }

    return 'source';
  }

  reads(path: string): boolean {
    return languageOf(path) !== null;
  }

  definitionsIn(path: string, added: readonly string[]): readonly string[] {
    const language = languageOf(path);

    return language
      ? [
          ...new Set(
            matchesIn(added, language.definitions).filter(
              (symbol) =>
                symbol.length >= LEAST_DEFINITION && !IGNORED.has(symbol),
            ),
          ),
        ]
      : [];
  }

  importsIn(path: string, added: readonly string[]): readonly string[] {
    const language = languageOf(path);

    return language ? matchesIn(added, language.imports) : [];
  }
}
