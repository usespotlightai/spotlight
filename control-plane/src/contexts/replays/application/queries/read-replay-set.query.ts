import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadReplaySetQuery {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly principal: Principal,
  ) {}
}
