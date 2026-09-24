import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteSecretCommand {
  constructor(
    readonly secretId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
