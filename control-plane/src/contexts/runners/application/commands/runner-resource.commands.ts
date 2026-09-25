import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateRunnerTrustCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}

export class UpdateRunnerTrustCommand {
  constructor(
    readonly trustId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}

export class DeleteRunnerTrustCommand {
  constructor(
    readonly trustId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}

export class CreateWorkspaceRunnersCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}

export class UpdateWorkspaceRunnersCommand {
  constructor(
    readonly declarationId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}

export class DeleteWorkspaceRunnersCommand {
  constructor(
    readonly declarationId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}

export class CreateRunnerPoolCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}

export class UpdateRunnerPoolCommand {
  constructor(
    readonly poolId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}

export class DeleteRunnerPoolCommand {
  constructor(
    readonly poolId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
