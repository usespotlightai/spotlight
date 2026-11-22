import type { JsonObject } from '@shared-kernel/domain/json-value';

export const RESULT_CHECKS = Symbol('ASSIST_RESULT_CHECKS');

export interface ResultIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export type ResultCheck =
  | { readonly fits: true; readonly result: unknown }
  | { readonly fits: false; readonly issues: readonly ResultIssue[] };

export interface ResultChecksPort {
  /** Checks a submitted result against the JSON Schema its session was ordered with. */
  check(schema: JsonObject, result: unknown): ResultCheck;
}
