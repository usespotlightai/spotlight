import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateLineCommand {
  constructor(
    readonly teamId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
