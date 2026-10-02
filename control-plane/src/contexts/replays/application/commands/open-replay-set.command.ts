import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class OpenReplaySetCommand {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly name: string,
    readonly principal: Principal,
  ) {}
}
