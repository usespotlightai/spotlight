import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadReplayQuery {
  constructor(
    readonly teamId: string,
    readonly replayId: string,
    readonly principal: Principal,
  ) {}
}
