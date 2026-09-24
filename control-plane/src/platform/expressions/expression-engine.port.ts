import type { Bindings } from '@platform/expressions/bindings';
import type { Scope } from '@platform/expressions/scope';

export const EXPRESSION_ENGINE = Symbol('EXPRESSION_ENGINE');

export interface Expression {
  readonly source: string;
  readonly at: string | null;
  evaluate(against: Bindings): unknown;
}

export interface Within {
  readonly at?: string;
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

  compile(source: string, within?: Within): Expression;
}
