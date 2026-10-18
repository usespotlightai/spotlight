import { factsOf } from '@change-review/domain/services/diff-facts';
import type {
  IndexedFile,
  IndexedSymbol,
  SymbolIndex,
} from '@change-review/domain/services/symbol-index';
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
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source code that the test reads
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
      { kind: 'uses', from: 'h1', to: 'h2', because: ['legacy (removed)'] },
    ]);
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
            ...(review as IndexedFile),
            symbols: [symbol('threadsOf', 1, { endLine: 5 })],
          },
          test as IndexedFile,
        ],
      }).links,
    ).toEqual([]);
  });
});
