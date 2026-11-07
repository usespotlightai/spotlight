import type { RunFilterQuery } from '@insights/application/queries/run-filter-query';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListInsightsTracesQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly range: string,
    readonly filter: RunFilterQuery,
  ) {}
}
