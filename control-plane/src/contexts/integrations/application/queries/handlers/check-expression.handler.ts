import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  CheckedExpression,
  ExpressionChecksPort,
} from '@integrations/application/ports/expression-checks.port';
import type { CheckExpressionQuery } from '@integrations/application/queries/check-expression.query';
import {
  type Forbidden,
  forbiddenTo,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class CheckExpressionHandler
  implements
    QueryHandlerPort<CheckExpressionQuery, CheckedExpression | Forbidden>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly checks: ExpressionChecksPort,
  ) {}

  async execute(
    query: CheckExpressionQuery,
  ): Promise<CheckedExpression | Forbidden> {
    if (!this.access.mayPlan(query.principal)) {
      return forbiddenTo('plan');
    }

    return this.checks.check(
      query.position,
      query.expression,
      query.definition,
    );
  }
}
