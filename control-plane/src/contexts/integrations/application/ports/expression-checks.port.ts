import type {
  ExpressionCheckDto,
  ExpressionPositionDto,
} from '@integrations/application/dto/expression-check.dto';
import type { Invalid } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const EXPRESSION_CHECKS = Symbol('EXPRESSION_CHECKS');

export type CheckedExpression =
  | { readonly outcome: 'checked'; readonly check: ExpressionCheckDto }
  | Invalid
  | { readonly outcome: 'not-an-integration' }
  | { readonly outcome: 'no-expression-there' };

export interface ExpressionChecksPort {
  check(
    position: FieldPath,
    expression: string,
    definition: unknown,
  ): CheckedExpression;
  positions(): readonly ExpressionPositionDto[];
}
