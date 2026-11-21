import type { JsonObject, JsonValue } from '@shared-kernel/domain/json-value';

interface CatalogToolInputShape {
  readonly name: string;
  readonly schema: JsonObject;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly stdin: boolean;
}

export interface CatalogToolShape {
  readonly id: string;
  readonly description: string;
  readonly inputs: readonly CatalogToolInputShape[];
}

export interface CatalogSkillShape {
  readonly id: string;
  readonly description: string;
  readonly files: readonly { readonly path: string; readonly text: string }[];
  readonly tools: readonly string[];
}

export type CatalogDenialReason = 'unknown' | 'wrong-kind';

export interface CatalogDenial {
  readonly id: string;
  readonly reason: CatalogDenialReason;
  readonly because: string;
}

export interface CatalogRequest {
  readonly tools: readonly string[];
  readonly skills: readonly string[];
}

export interface ResolvedItems {
  readonly tools: readonly CatalogToolShape[];
  readonly skills: readonly CatalogSkillShape[];
  readonly denied: readonly CatalogDenial[];
}

export type CatalogInputValues = Readonly<Record<string, JsonValue>>;

export type CatalogCallResult =
  | { readonly kind: 'answered'; readonly output: unknown }
  | { readonly kind: 'denied'; readonly denial: CatalogDenial };
