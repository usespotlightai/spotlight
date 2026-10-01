import type { RunFilterAsked } from '@outcomes/domain/services/run-filter';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListInsightsRunsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly period: string,
    readonly filter: RunFilterAsked,
    readonly page: number | null,
    readonly size: number | null,
  ) {}
}
