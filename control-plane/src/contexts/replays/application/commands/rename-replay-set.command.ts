import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class RenameReplaySetCommand {
  constructor(
    readonly teamId: string,
    readonly setId: string,
    readonly name: string,
    readonly principal: Principal,
  ) {}
}
