import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateWorkspaceTokenCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}

export class UpdateWorkspaceTokenCommand {
  constructor(
    readonly tokenId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}

export class DeleteWorkspaceTokenCommand {
  constructor(
    readonly tokenId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
