import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadStationAlertQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly alertId: string,
  ) {}
}
