import type { DiffSource } from '@change-review/application/ports/diff-reader.port';
import { HUNK_THAT_NEVER_PARSES } from '@change-review/infrastructure/change-stacks/tree-sitter/hunk-that-never-parses.fake-spec';
import { ThreadedSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/threaded-symbol.indexer';
import { describe, expect, it, vi } from 'vitest';

const source = (path: string, lines: string[]): DiffSource => ({
  path,
  side: 'after',
  text: lines.join('\n'),
});

describe('ThreadedSymbolIndexer', () => {
  it('indexes the changed code on a thread of its own', async () => {
    const index = await new ThreadedSymbolIndexer().index([
      source('src/invite.ts', ['export const invite = () => 1;']),
    ]);

    expect(
      index.files.map((file) => [file.path, file.symbols.map((s) => s.name)]),
    ).toEqual([['src/invite.ts', ['invite']]]);
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

  it('stops the thread and fails when indexing takes longer than allowed', async () => {
    await expect(
      new ThreadedSymbolIndexer(500).index([
        source('src/profiles.spec.ts', HUNK_THAT_NEVER_PARSES),
      ]),
    ).rejects.toThrow('Indexing the changed code took longer than 0.5 seconds');
  }, 30_000);

  it('indexes at most two diffs at once and answers every one', async () => {
    const indexer = new ThreadedSymbolIndexer();
    const threads = vi.spyOn(
      indexer as unknown as { inWorker: () => unknown },
      'inWorker',
    );
    let most = 0;
    let now = 0;
    threads.mockImplementation(async () => {
      now += 1;
      most = Math.max(most, now);
      await new Promise((done) => setTimeout(done, 20));
      now -= 1;
      return { files: [] };
    });

    const answered = await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        indexer.index([source('src/invite.ts', ['export const a = 1;'])]),
      ),
    );

    expect(answered).toHaveLength(5);
    expect(most).toBe(2);
    expect(threads).toHaveBeenCalledTimes(5);
  });

  it('answers at once when there is nothing to index', async () => {
    expect(await new ThreadedSymbolIndexer().index([])).toEqual({ files: [] });
  });
});
