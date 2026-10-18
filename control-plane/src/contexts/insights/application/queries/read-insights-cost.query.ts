import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadInsightsCostQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly period: string,
  ) {}
}
