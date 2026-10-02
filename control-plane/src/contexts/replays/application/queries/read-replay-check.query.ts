import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadReplayCheckQuery {
  constructor(
    readonly teamId: string,
    readonly checkId: string,
    readonly principal: Principal,
  ) {}
}
