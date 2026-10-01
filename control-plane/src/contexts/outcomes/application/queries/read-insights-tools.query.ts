import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadInsightsToolsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly period: string,
  ) {}
}
