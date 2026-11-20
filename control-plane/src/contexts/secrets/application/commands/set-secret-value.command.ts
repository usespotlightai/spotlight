import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class SetSecretValueCommand {
  constructor(
    readonly slug: string,
    readonly name: string,
    readonly actor: Actor,
    readonly value: string,
  ) {}
}
