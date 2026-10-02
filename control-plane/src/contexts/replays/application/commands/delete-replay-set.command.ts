import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class DeleteReplaySetCommand {
  constructor(
    readonly teamId: string,
    readonly setId: string,
    readonly principal: Principal,
  ) {}
}
