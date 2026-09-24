import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class UpdateSecretCommand {
  constructor(
    readonly secretId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
