import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadInsightsSetupsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly period: string,
    readonly stationId: string | null,
    readonly size: string | null,
  ) {}
}
