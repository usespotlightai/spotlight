import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';

import type { DiffSources } from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import type { SymbolIndex } from '@change-review/domain/value-objects/symbol-index.vo';

const FROM_SOURCE = extname(__filename) === '.ts';

const WORKER = join(__dirname, `symbol-index.worker${extname(__filename)}`);

const FROM_SOURCE_WITH = {
  execArgv: [
    '-r',
    'ts-node/register/transpile-only',
    '-r',
    'tsconfig-paths/register',
  ],
  // oxlint-disable-next-line node/no-process-env -- the worker runs with the parent environment
  env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.build.json' },
};

const MAX_HEAP_MB = 1024;

export const INDEX_WITHIN_MS = 60_000;

const THREADS = 2;

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class ThreadedSymbolIndexer implements SymbolIndexerPort {
  private running = 0;

  private readonly waiting: (() => void)[] = [];

  constructor(private readonly withinMs: number = INDEX_WITHIN_MS) {}

  async index(sources: DiffSources): Promise<SymbolIndex> {
    if (sources.length === 0) {
      return { files: [] };
    }

    if (this.running >= THREADS) {
      await new Promise<void>((handed) => this.waiting.push(handed));
    } else {
      this.running += 1;
    }

    try {
      return await this.inWorker(sources);
    } finally {
      const next = this.waiting.shift();

      if (next) {
        next();
      } else {
        this.running -= 1;
      }
    }
  }

  private inWorker(sources: DiffSources): Promise<SymbolIndex> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER, {
        workerData: sources,
        ...(FROM_SOURCE ? FROM_SOURCE_WITH : {}),
        resourceLimits: { maxOldGenerationSizeMb: MAX_HEAP_MB },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(
          new Error(
            `Indexing the changed code took longer than ${this.withinMs / 1000} seconds`,
          ),
        );
      }, this.withinMs);
      const stopTimer = () => clearTimeout(timer);

      worker.once('message', (index: SymbolIndex) => {
        stopTimer();
        void worker.terminate();
        resolve(index);
      });
      worker.once('error', (error) => {
        stopTimer();
        reject(
          new Error(`Indexing the changed code failed: ${reasonOf(error)}`),
        );
      });
      worker.once('exit', (code) => {
        stopTimer();
        reject(
          new Error(`Indexing the changed code stopped with code ${code}`),
        );
      });
    });
  }
}
