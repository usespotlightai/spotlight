import type {
  CheckedExpression,
  ExpressionChecksPort,
} from '@integrations/application/ports/expression-checks.port';
import type { CheckExpressionQuery } from '@integrations/application/queries/check-expression.query';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class CheckExpressionHandler
  implements QueryHandlerPort<CheckExpressionQuery, CheckedExpression>
{
  constructor(private readonly checks: ExpressionChecksPort) {}

  async execute(query: CheckExpressionQuery): Promise<CheckedExpression> {
    return this.checks.check(
      query.position,
      query.expression,
      query.definition,
    );
  }
}
