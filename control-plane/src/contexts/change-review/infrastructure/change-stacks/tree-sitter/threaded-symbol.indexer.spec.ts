import type { DiffSource } from '@change-review/application/ports/diff-reader.port';
import type { IndexedFile } from '@change-review/domain/value-objects/symbol-index.vo';
import { HUNK_THAT_NEVER_PARSES } from '@change-review/infrastructure/change-stacks/tree-sitter/hunk-that-never-parses.fake-spec';
import { ThreadedSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/threaded-symbol.indexer';
import { describe, expect, it } from 'vitest';

const source = (path: string, lines: string[]): DiffSource => ({
  path,
  side: 'after',
  text: lines.join('\n'),
});

const namesOf = (files: readonly IndexedFile[]) =>
  files.map((file) => [file.path, file.symbols.map((each) => each.name)]);

describe('ThreadedSymbolIndexer', () => {
  it('indexes the changed code on a thread of its own', async () => {
    const index = await new ThreadedSymbolIndexer().index([
      source('src/invite.ts', ['export const invite = () => 1;']),
    ]);

    expect(namesOf(index.files)).toEqual([['src/invite.ts', ['invite']]]);
  }, 30_000);

  it('keeps the event loop free while a file takes long to parse', async () => {
    let ticks = 0;
    const ticking = setInterval(() => {
      ticks += 1;
    }, 50);

    try {
      await new ThreadedSymbolIndexer().index([
        source('src/profiles.spec.ts', HUNK_THAT_NEVER_PARSES),
      ]);
    } finally {
      clearInterval(ticking);
    }

    expect(ticks).toBeGreaterThan(20);
  }, 30_000);

  it('answers with the files it parsed when its time for parsing runs out', async () => {
    const index = await new ThreadedSymbolIndexer(12_500).index([
      source('src/invite.ts', ['export const invite = () => 1;']),
      source('src/profiles.spec.ts', HUNK_THAT_NEVER_PARSES),
      source('src/more.spec.ts', HUNK_THAT_NEVER_PARSES),
      source('src/resend.ts', ['export const resend = () => 2;']),
    ]);

    expect(namesOf(index.files)).toEqual([['src/invite.ts', ['invite']]]);
  }, 30_000);

  it('indexes at most two diffs at once and answers every one', async () => {
    let ticks = 0;
    const ticking = setInterval(() => {
      ticks += 1;
    }, 50);
    const indexer = new ThreadedSymbolIndexer();
    const started = Date.now();

    try {
      const answered = await Promise.all(
        [1, 2, 3].map(() =>
          indexer.index([
            source('src/profiles.spec.ts', HUNK_THAT_NEVER_PARSES),
          ]),
        ),
      );

      expect(answered).toEqual([{ files: [] }, { files: [] }, { files: [] }]);
    } finally {
      clearInterval(ticking);
    }

    expect(Date.now() - started).toBeGreaterThan(4_000);
    expect(ticks).toBeGreaterThan(40);
  }, 30_000);

  it('answers at once when there is nothing to index', async () => {
    expect(await new ThreadedSymbolIndexer().index([])).toEqual({ files: [] });
  });
});
