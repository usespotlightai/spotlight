import type {
  JsonObject,
  JsonValue,
} from '@shared-kernel/domain/services/json-value';

interface CatalogToolInputShape {
  readonly name: string;
  readonly schema: JsonObject;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

export interface CatalogToolEntitled {
  readonly id: string;
  readonly description: string;
  readonly inputs: readonly CatalogToolInputShape[];
}

export interface CatalogSkillEntitled {
  readonly id: string;
  readonly description: string;
  readonly files: readonly { readonly path: string; readonly text: string }[];
  readonly tools: readonly string[];
}

export type CatalogDenialReason =
  | 'unknown'
  | 'wrong-kind'
  | 'not-entitled'
  | 'lapsed';

export interface CatalogDenial {
  readonly id: string;
  readonly reason: CatalogDenialReason;
  readonly because: string;
}

export interface CatalogNamed {
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface EntitledItems {
  readonly tools: readonly CatalogToolEntitled[];
  readonly skills: readonly CatalogSkillEntitled[];
  readonly denied: readonly CatalogDenial[];
}

export type CatalogInputValues = Readonly<Record<string, JsonValue>>;

export type CatalogCallAnswer =
  | { readonly kind: 'answered'; readonly output: unknown }
  | { readonly kind: 'denied'; readonly denial: CatalogDenial };
