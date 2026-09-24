import type { ExpressionPositionDto } from '@integrations/application/dto/expression-check.dto';
import type { ExpressionChecksPort } from '@integrations/application/ports/expression-checks.port';
import type { ListExpressionPositionsQuery } from '@integrations/application/queries/list-expression-positions.query';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListExpressionPositionsHandler
  implements
    QueryHandlerPort<
      ListExpressionPositionsQuery,
      readonly ExpressionPositionDto[]
    >
{
  constructor(private readonly checks: ExpressionChecksPort) {}

  async execute(): Promise<readonly ExpressionPositionDto[]> {
    return this.checks.positions();
  }
}
