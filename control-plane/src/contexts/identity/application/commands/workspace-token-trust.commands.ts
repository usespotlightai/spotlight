import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateWorkspaceTokenTrustCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}

export class UpdateWorkspaceTokenTrustCommand {
  constructor(
    readonly trustId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}

export class DeleteWorkspaceTokenTrustCommand {
  constructor(
    readonly trustId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
