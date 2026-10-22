import type { RunFilterQuery } from '@insights/domain/services/run-filter';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListInsightsTracesQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly range: string,
    readonly filter: RunFilterQuery,
  ) {}
}
