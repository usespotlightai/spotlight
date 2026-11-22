import { extname, join } from 'node:path';

import type { DiffSources } from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import type { SymbolIndex } from '@change-review/domain/value-objects/symbol-index.vo';
import { inThread } from '@platform/threads/in-thread';
import { ThreadSlots } from '@platform/threads/thread-slots';

const WORKER = join(__dirname, `symbol-index.worker${extname(__filename)}`);

const INDEX_WITHIN_MS = 60_000;

const STARTING_MS = 10_000;

export interface SymbolIndexInput {
  readonly sources: DiffSources;
  readonly parsingWithinMs: number;
}

export class ThreadedSymbolIndexer implements SymbolIndexerPort {
  private readonly slots = new ThreadSlots(2);

  constructor(private readonly withinMs: number = INDEX_WITHIN_MS) {}

  async index(sources: DiffSources): Promise<SymbolIndex> {
    if (sources.length === 0) {
      return { files: [] };
    }

    const late = () =>
      new Error(
        `Indexing the changed code took longer than ${this.withinMs / 1000} seconds`,
      );

    return this.slots.within(Date.now() + this.withinMs, late, (left) =>
      inThread<SymbolIndexInput, SymbolIndex>(
        WORKER,
        { sources, parsingWithinMs: Math.max(left - STARTING_MS, 0) },
        {
          within: left,
          late,
          failed: (reason) =>
            new Error(`Indexing the changed code failed: ${reason}`),
        },
      ),
    );
  }
}
