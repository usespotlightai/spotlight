import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateIntegrationCommand {
  constructor(
    readonly teamId: string,
    readonly actor: Actor,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
