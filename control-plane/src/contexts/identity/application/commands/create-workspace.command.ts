import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateWorkspaceCommand {
  constructor(
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
