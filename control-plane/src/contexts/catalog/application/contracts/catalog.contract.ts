interface CatalogToolInputShape {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean';
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

export interface CatalogToolGiven {
  readonly id: string;
  readonly description: string;
  readonly inputs: readonly CatalogToolInputShape[];
}

export interface CatalogSkillGiven {
  readonly id: string;
  readonly description: string;
  readonly files: readonly { readonly path: string; readonly text: string }[];
  readonly tools: readonly string[];
}

export type CatalogRefusalReason =
  | 'unknown'
  | 'wrong-kind'
  | 'not-entitled'
  | 'lapsed';

export interface CatalogRefusal {
  readonly id: string;
  readonly reason: CatalogRefusalReason;
  readonly because: string;
}

export interface CatalogNamed {
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface CatalogGiving {
  readonly tools: readonly CatalogToolGiven[];
  readonly skills: readonly CatalogSkillGiven[];
  readonly refused: readonly CatalogRefusal[];
}

export type CatalogInputValues = Readonly<
  Record<string, string | number | boolean>
>;

export type CatalogCallAnswer =
  | { readonly kind: 'answered'; readonly output: unknown }
  | { readonly kind: 'refused'; readonly refusal: CatalogRefusal };
