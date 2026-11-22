import { workerData } from 'node:worker_threads';

import type { SymbolIndexInput } from '@change-review/infrastructure/change-stacks/tree-sitter/threaded-symbol.indexer';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';
import { answerParent } from '@platform/threads/in-thread';

const { sources, parsingWithinMs } = workerData as SymbolIndexInput;

answerParent(() => new TreeSitterSymbolIndexer(parsingWithinMs).index(sources));
