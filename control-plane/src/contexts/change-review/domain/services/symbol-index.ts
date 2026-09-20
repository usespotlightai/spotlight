export type SourceSide = 'before' | 'after';

const SYMBOL_KINDS = [
  'function',
  'class',
  'type',
  'constant',
  'component',
  'method',
  'route',
] as const;

export type SymbolKind = (typeof SYMBOL_KINDS)[number];

export interface IndexedSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly line: number;
  readonly endLine: number;
  readonly exportedAs: readonly string[];
}

export interface IndexedImport {
  readonly local: string;
  readonly imported: string;
  readonly specifier: string;
  readonly resolved: readonly string[];
  readonly project: boolean;
}

export interface IndexedReference {
  readonly name: string;
  readonly line: number;
  readonly through: string | null;
}

export interface IndexedRouteUse {
  readonly path: string;
  readonly line: number;
}

export interface IndexedFile {
  readonly path: string;
  readonly side: SourceSide;
  readonly scope: readonly string[];
  readonly symbols: readonly IndexedSymbol[];
  readonly imports: readonly IndexedImport[];
  readonly references: readonly IndexedReference[];
  readonly routeUses: readonly IndexedRouteUse[];
}

export interface SymbolIndex {
  readonly files: readonly IndexedFile[];
}

export const NO_INDEX: SymbolIndex = { files: [] };
