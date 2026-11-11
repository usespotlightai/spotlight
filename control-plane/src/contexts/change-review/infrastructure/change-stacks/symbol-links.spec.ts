import { factsOf } from '@change-review/domain/services/diff-facts';
import type {
  IndexedFile,
  IndexedSymbol,
  SymbolIndex,
} from '@change-review/domain/value-objects/symbol-index.vo';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { describe, expect, it } from 'vitest';

const added = (path: string, lines: string[]) =>
  [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n');

const symbol = (
  name: string,
  line: number,
  over: Partial<IndexedSymbol> = {},
): IndexedSymbol => ({
  name,
  kind: 'function',
  line,
  endLine: line,
  exportedAs: [name],
  ...over,
});

const file = (path: string, over: Partial<IndexedFile> = {}): IndexedFile => ({
  path,
  side: 'after',
  scope: [path],
  symbols: [],
  imports: [],
  references: [],
  routeUses: [],
  ...over,
});

const factsWith = (diff: string[], index: SymbolIndex) =>
  factsOf(
    new GitDiffReader().read(diff.join('\n')).diff,
    new PatternCodeReading(),
    index,
  );

describe('factsOf with a symbol index', () => {
  const DIFF = [
    added('src/invite.ts', ['export function send() {}']),
    added('src/page.tsx', ['send();', 'mail.address;', 'resend();']),
  ];

  it('links a use to the import it resolves through, not to any same-named symbol', () => {
    const facts = factsWith(DIFF, {
      files: [
        file('src/invite.ts', { symbols: [symbol('send', 1)] }),
        file('src/page.tsx', {
          imports: [
            {
              local: 'send',
              imported: 'send',
              specifier: './invite',
              resolved: ['src/invite.ts'],
              project: true,
            },
            {
              local: 'mail',
              imported: '*',
              specifier: '@/lib/mail',
              resolved: [],
              project: true,
            },
          ],
          references: [
            { name: 'send', line: 1, through: null },
            { name: 'address', line: 2, through: 'mail' },
          ],
        }),
      ],
    });

    expect(facts.links).toEqual([
      { kind: 'uses', from: 'h2', to: 'h1', because: ['send'] },
    ]);
    expect(facts.hunks.map((each) => each.defines)).toEqual([['send'], []]);
    expect(facts.hunks[1]?.outside).toEqual(['mail.address from @/lib/mail']);
  });

  it('draws no link where the name only matches something the file does not import', () => {
    const facts = factsWith(DIFF, {
      files: [
        file('src/invite.ts', { symbols: [symbol('send', 1)] }),
        file('src/page.tsx', {
          references: [{ name: 'send', line: 1, through: null }],
        }),
      ],
    });

    expect(facts.links).toEqual([]);
  });

  it('links a method call to the few changes that define that method', () => {
    const facts = factsWith(
      [
        added('src/invite.ts', ['class Invite {', '  resend() {}', '}']),
        added('src/page.tsx', ['invite.resend();']),
      ],
      {
        files: [
          file('src/invite.ts', {
            symbols: [
              symbol('Invite', 1, { kind: 'class' }),
              symbol('resend', 2, { kind: 'method', exportedAs: [] }),
            ],
          }),
          file('src/page.tsx', {
            references: [{ name: 'resend', line: 1, through: 'invite' }],
          }),
        ],
      },
    );

    expect(facts.links).toEqual([
      { kind: 'uses', from: 'h2', to: 'h1', because: ['resend'] },
    ]);
  });

  it('links a call to the route it calls', () => {
    const facts = factsWith(
      [
        added('api/runs.go', ['r.Get("/teams/{team}/runs", list)']),
        // oxlint-disable-next-line no-template-curly-in-string -- source code that the test reads
        added('web/api.ts', ['fetch(`/api/teams/${team}/runs`)']),
      ],
      {
        files: [
          file('api/runs.go', {
            symbols: [
              symbol('GET /teams/{team}/runs', 1, {
                kind: 'route',
                exportedAs: [],
              }),
            ],
          }),
          file('web/api.ts', {
            routeUses: [{ path: '/api/teams/:param/runs', line: 1 }],
          }),
        ],
      },
    );

    expect(facts.links).toEqual([
      {
        kind: 'uses',
        from: 'h2',
        to: 'h1',
        because: ['GET /teams/{team}/runs'],
      },
    ]);
  });

  it('keeps a removed definition after the removal of what used it', () => {
    const removed = (path: string, lines: string[]) =>
      [
        `diff --git a/${path} b/${path}`,
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@ -1,${lines.length} +0,0 @@`,
        ...lines.map((line) => `-${line}`),
      ].join('\n');

    const facts = factsWith(
      [
        removed('src/legacy.ts', ['export function legacy() {}']),
        removed('src/page.ts', ['legacy();']),
      ],
      {
        files: [
          file('src/legacy.ts', {
            side: 'before',
            symbols: [symbol('legacy', 1)],
          }),
          file('src/legacy.ts'),
          file('src/page.ts', {
            side: 'before',
            scope: ['src/page.ts'],
            imports: [
              {
                local: 'legacy',
                imported: 'legacy',
                specifier: './legacy',
                resolved: ['src/legacy.ts'],
                project: true,
              },
            ],
            references: [{ name: 'legacy', line: 1, through: null }],
          }),
        ],
      },
    );

    expect(facts.links).toEqual([
      { kind: 'removes', from: 'h1', to: 'h2', because: ['legacy'] },
    ]);
  });

  it('links no removal to a use of a definition that the change keeps', () => {
    const removed = (path: string, lines: string[]) =>
      [
        `diff --git a/${path} b/${path}`,
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@ -1,${lines.length} +0,0 @@`,
        ...lines.map((line) => `-${line}`),
      ].join('\n');

    const facts = factsWith(
      [
        removed('src/legacy.ts', ['export function legacy() {}']),
        removed('src/page.ts', ['legacy();']),
      ],
      {
        files: [
          file('src/legacy.ts', {
            side: 'before',
            symbols: [symbol('legacy', 1)],
          }),
          file('src/legacy.ts', { symbols: [symbol('legacy', 1)] }),
          file('src/page.ts', {
            side: 'before',
            scope: ['src/page.ts'],
            imports: [
              {
                local: 'legacy',
                imported: 'legacy',
                specifier: './legacy',
                resolved: ['src/legacy.ts'],
                project: true,
              },
            ],
            references: [{ name: 'legacy', line: 1, through: null }],
          }),
        ],
      },
    );

    expect(facts.links).toEqual([]);
  });

  it('links no removal when a function becomes an arrow function constant', () => {
    const removed = (path: string, lines: string[]) =>
      [
        `diff --git a/${path} b/${path}`,
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@ -1,${lines.length} +0,0 @@`,
        ...lines.map((line) => `-${line}`),
      ].join('\n');

    const facts = factsWith(
      [
        removed('src/legacy.ts', ['export function legacy() {}']),
        removed('src/page.ts', ['legacy();']),
      ],
      {
        files: [
          file('src/legacy.ts', {
            side: 'before',
            symbols: [symbol('legacy', 1)],
          }),
          file('src/legacy.ts', {
            symbols: [symbol('legacy', 1, { kind: 'constant' })],
          }),
          file('src/page.ts', {
            side: 'before',
            scope: ['src/page.ts'],
            imports: [
              {
                local: 'legacy',
                imported: 'legacy',
                specifier: './legacy',
                resolved: ['src/legacy.ts'],
                project: true,
              },
            ],
            references: [{ name: 'legacy', line: 1, through: null }],
          }),
        ],
      },
    );

    expect(facts.links).toEqual([]);
  });

  it('links a removal of a method that another class keeps by name', () => {
    const removed = (path: string, lines: string[]) =>
      [
        `diff --git a/${path} b/${path}`,
        `--- a/${path}`,
        `+++ b/${path}`,
        `@@ -1,${lines.length} +0,0 @@`,
        ...lines.map((line) => `-${line}`),
      ].join('\n');
    const classWithLegacy = (name: string) => [
      symbol(name, 1, { kind: 'class', endLine: 3 }),
      symbol('legacy', 2, { kind: 'method' }),
    ];

    const facts = factsWith(
      [
        removed('src/legacy.ts', ['class Old {', '  legacy() {}', '}']),
        removed('src/page.ts', ['legacy();']),
      ],
      {
        files: [
          file('src/legacy.ts', {
            side: 'before',
            symbols: classWithLegacy('Old'),
          }),
          file('src/legacy.ts', { symbols: classWithLegacy('New') }),
          file('src/page.ts', {
            side: 'before',
            scope: ['src/page.ts'],
            imports: [
              {
                local: 'legacy',
                imported: 'legacy',
                specifier: './legacy',
                resolved: ['src/legacy.ts'],
                project: true,
              },
            ],
            references: [{ name: 'legacy', line: 1, through: null }],
          }),
        ],
      },
    );

    expect(facts.links).toEqual([
      { kind: 'removes', from: 'h1', to: 'h2', because: ['legacy'] },
    ]);
  });
});

describe('removals across renames and kinds', () => {
  const page = file('src/page.ts', {
    side: 'before',
    scope: ['src/page.ts'],
    imports: [
      {
        local: 'Legacy',
        imported: 'Legacy',
        specifier: './legacy',
        resolved: ['src/legacy.ts'],
        project: true,
      },
    ],
    references: [{ name: 'Legacy', line: 1, through: null }],
  });
  const pageRemoved = [
    'diff --git a/src/page.ts b/src/page.ts',
    '--- a/src/page.ts',
    '+++ b/src/page.ts',
    '@@ -1 +0,0 @@',
    '-Legacy();',
  ].join('\n');

  it('links no removal of a definition that a renamed file keeps', () => {
    const facts = factsWith(
      [
        [
          'diff --git a/src/legacy.ts b/src/kept.ts',
          'similarity index 50%',
          'rename from src/legacy.ts',
          'rename to src/kept.ts',
          '--- a/src/legacy.ts',
          '+++ b/src/kept.ts',
          '@@ -1 +1 @@',
          '-export function Legacy() {}',
          '+export function Legacy(a) {}',
        ].join('\n'),
        pageRemoved,
      ],
      {
        files: [
          file('src/legacy.ts', {
            side: 'before',
            symbols: [symbol('Legacy', 1)],
          }),
          file('src/kept.ts', { symbols: [symbol('Legacy', 1)] }),
          page,
        ],
      },
    );

    expect(facts.links.filter((each) => each.kind === 'removes')).toEqual([]);
  });

  it('links a removal of a value that the change leaves only as a type', () => {
    const facts = factsWith(
      [
        [
          'diff --git a/src/legacy.ts b/src/legacy.ts',
          '--- a/src/legacy.ts',
          '+++ b/src/legacy.ts',
          '@@ -1 +1 @@',
          '-export const Legacy = 1;',
          '+export type Legacy = number;',
        ].join('\n'),
        pageRemoved,
      ],
      {
        files: [
          file('src/legacy.ts', {
            side: 'before',
            symbols: [symbol('Legacy', 1, { kind: 'constant' })],
          }),
          file('src/legacy.ts', {
            symbols: [symbol('Legacy', 1, { kind: 'type' })],
          }),
          page,
        ],
      },
    );

    expect(facts.links.filter((each) => each.kind === 'removes')).toEqual([
      { kind: 'removes', from: 'h1', to: 'h2', because: ['Legacy'] },
    ]);
  });
});

describe('removals where the after side is unknown', () => {
  const removedLines = (path: string, lines: string[], deleted = false) =>
    [
      `diff --git a/${path} b/${path}`,
      ...(deleted ? ['deleted file mode 100644'] : []),
      `--- a/${path}`,
      deleted ? '+++ /dev/null' : `+++ b/${path}`,
      `@@ -1,${lines.length} +0,0 @@`,
      ...lines.map((line) => `-${line}`),
    ].join('\n');
  const index = {
    files: [
      file('src/legacy.ts', {
        side: 'before' as const,
        symbols: [symbol('legacy', 1)],
      }),
      file('src/page.ts', {
        side: 'before' as const,
        scope: ['src/page.ts'],
        imports: [
          {
            local: 'legacy',
            imported: 'legacy',
            specifier: './legacy',
            resolved: ['src/legacy.ts'],
            project: true,
          },
        ],
        references: [{ name: 'legacy', line: 1, through: null }],
      }),
    ],
  };

  it('links no removal where the changed file was not indexed after the change', () => {
    const facts = factsWith(
      [
        removedLines('src/legacy.ts', ['export function legacy() {}']),
        removedLines('src/page.ts', ['legacy();']),
      ],
      index,
    );

    expect(facts.links).toEqual([]);
  });

  it('links a removal from a deleted file', () => {
    const facts = factsWith(
      [
        removedLines('src/legacy.ts', ['export function legacy() {}'], true),
        removedLines('src/page.ts', ['legacy();']),
      ],
      index,
    );

    expect(facts.links).toEqual([
      { kind: 'removes', from: 'h1', to: 'h2', because: ['legacy'] },
    ]);
  });
});

describe('moved code', () => {
  it('finds no move to or from an incidental hunk', () => {
    const block = ['"a": 1,', '"b": 2,', '"c": 3,'];
    const facts = factsWith(
      [
        [
          'diff --git a/package-lock.json b/package-lock.json',
          '--- a/package-lock.json',
          '+++ b/package-lock.json',
          '@@ -1,3 +0,0 @@',
          ...block.map((line) => `-${line}`),
        ].join('\n'),
        added('src/config.ts', block),
      ],
      { files: [] },
    );

    expect(facts.links.filter((each) => each.kind === 'moves')).toEqual([]);
    expect(facts.hunks.map((each) => each.moved)).toEqual([false, false]);
  });
});

describe('test pairing through resolved imports', () => {
  const modified = (path: string, at: number, from: string, to: string) =>
    [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      `@@ -${at} +${at} @@`,
      `-${from}`,
      `+${to}`,
    ].join('\n');

  const DIFF = [
    modified('src/lib/review.ts', 12, '  return [];', '  return threads;'),
    added('src/components/Thread.test.tsx', [
      'expect(threadsOf(x)).toEqual([]);',
    ]),
  ];

  const imports = (resolved: string[]) => [
    {
      local: 'threadsOf',
      imported: 'threadsOf',
      specifier: '@/lib/review',
      resolved,
      project: true,
    },
  ];

  const index = (resolved: string[]): SymbolIndex => ({
    files: [
      file('src/lib/review.ts', {
        symbols: [symbol('threadsOf', 10, { endLine: 14 })],
      }),
      file('src/components/Thread.test.tsx', {
        imports: imports(resolved),
        references: [{ name: 'threadsOf', line: 1, through: null }],
      }),
    ],
  });

  it('pairs a test with the changes inside what it imports, whatever either file is called', () => {
    expect(factsWith(DIFF, index(['src/lib/review.ts'])).links).toEqual([
      { kind: 'tests', from: 'h2', to: 'h1', because: ['review.ts'] },
    ]);
  });

  it('pairs nothing where the import does not resolve to a changed file', () => {
    expect(factsWith(DIFF, index([])).links).toEqual([]);
  });

  it('pairs nothing where the change sits outside what the test imports', () => {
    const outside = index(['src/lib/review.ts']);
    const [review, test] = outside.files;

    expect(
      factsWith(DIFF, {
        files: [
          {
            ...review,
            symbols: [symbol('threadsOf', 1, { endLine: 5 })],
          },
          test,
        ],
      }).links,
    ).toEqual([]);
  });
});
