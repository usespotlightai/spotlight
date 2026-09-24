import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateSecretCommand {
  constructor(
    readonly workspaceId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
