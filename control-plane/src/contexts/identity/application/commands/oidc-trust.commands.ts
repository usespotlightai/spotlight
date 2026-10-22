import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateOidcTrustCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}

export class UpdateOidcTrustCommand {
  constructor(
    readonly trustId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}

export class DeleteOidcTrustCommand {
  constructor(
    readonly trustId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
