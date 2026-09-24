import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteWorkspaceCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
