import { workerData } from 'node:worker_threads';

import type { DiffSource } from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexInput } from '@change-review/infrastructure/change-stacks/tree-sitter/threaded-symbol.indexer';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';
import { answerParent } from '@platform/threads/in-thread';

const isSource = (value: unknown): value is DiffSource =>
  typeof value === 'object' &&
  value !== null &&
  'path' in value &&
  typeof value.path === 'string' &&
  'side' in value &&
  (value.side === 'before' || value.side === 'after') &&
  'text' in value &&
  typeof value.text === 'string';

const isInput = (value: unknown): value is SymbolIndexInput =>
  typeof value === 'object' &&
  value !== null &&
  'sources' in value &&
  Array.isArray(value.sources) &&
  value.sources.every(isSource) &&
  'parsingWithinMs' in value &&
  typeof value.parsingWithinMs === 'number';

const input: unknown = workerData;

answerParent(() => {
  if (!isInput(input)) {
    throw new Error('The symbol index worker got no diff sources to index.');
  }

  return new TreeSitterSymbolIndexer(input.parsingWithinMs).index(
    input.sources,
  );
});
