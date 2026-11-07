import type { DiffSources } from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndex } from '@change-review/domain/value-objects/symbol-index.vo';

export const SYMBOL_INDEXER = Symbol('SYMBOL_INDEXER');

export interface SymbolIndexerPort {
  index(sources: DiffSources): Promise<SymbolIndex>;
}
