import { parentPort, workerData } from 'node:worker_threads';

import type { DiffSources } from '@change-review/application/ports/diff-reader.port';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';

void new TreeSitterSymbolIndexer()
  .index(workerData as DiffSources)
  .then((index) => parentPort?.postMessage(index));
