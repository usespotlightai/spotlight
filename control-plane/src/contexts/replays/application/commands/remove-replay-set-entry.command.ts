import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class RemoveReplaySetEntryCommand {
  constructor(
    readonly teamId: string,
    readonly setId: string,
    readonly runId: string,
    readonly principal: Principal,
  ) {}
}
