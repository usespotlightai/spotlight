import type { RunFilterQuery } from '@insights/domain/services/run-filter';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListInsightsRunsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly period: string,
    readonly filter: RunFilterQuery,
    readonly page: number | null,
    readonly size: number | null,
  ) {}
}
