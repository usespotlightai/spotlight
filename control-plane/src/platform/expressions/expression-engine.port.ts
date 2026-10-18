import type { CelVariables } from '@platform/expressions/cel-variables';
import type { Scope } from '@platform/expressions/scope';

export const EXPRESSION_ENGINE = Symbol('EXPRESSION_ENGINE');

export interface Expression {
  readonly source: string;
  readonly location: string | null;
  evaluate(against: CelVariables): unknown;
}

export interface CompileOptions {
  readonly location?: string;
}

export interface ExpressionSpan {
  readonly start: number;
  readonly end: number;
}

export type ExpressionCheck =
  | { readonly valid: true; readonly type: string }
  | {
      readonly valid: false;
      readonly reason: string;
      readonly span: ExpressionSpan | null;
      readonly suggestion: string | null;
    };

export interface ExpressionEnginePort {
  check(source: string, scope: Scope): ExpressionCheck;

  compile(source: string, options?: CompileOptions): Expression;
}
