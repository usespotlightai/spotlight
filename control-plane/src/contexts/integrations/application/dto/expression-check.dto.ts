import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const EXPRESSION_RETURNS_NAMES = ['bool', 'list'] as const;

export type ExpressionReturns = (typeof EXPRESSION_RETURNS_NAMES)[number];

export const EXPRESSION_ADDED_VARIABLE_NAMES = [
  'item',
  'captures',
  'inputs',
] as const;

export type ExpressionAddedVariable =
  (typeof EXPRESSION_ADDED_VARIABLE_NAMES)[number];

export interface ExpressionSpanDto {
  readonly start: number;
  readonly end: number;
}

export interface ExpressionErrorDto {
  readonly message: string;
  readonly span: ExpressionSpanDto | null;
  readonly suggestion: string | null;
}

export interface ExpressionWarningDto {
  readonly position: FieldPath;
  readonly message: string;
}

export interface ExpressionCheckDto {
  readonly type: string | null;
  readonly errors: readonly ExpressionErrorDto[];
  readonly warnings: readonly ExpressionWarningDto[];
}

export interface ExpressionDeclarationDto {
  readonly name: string;
  readonly type: string;
  readonly fields: readonly ExpressionDeclarationDto[];
}

export interface ExpressionPositionDto {
  readonly position: FieldPath;
  readonly returns: ExpressionReturns | null;
  readonly variables: readonly ExpressionDeclarationDto[];
  readonly addedVariables: readonly ExpressionAddedVariable[];
}
