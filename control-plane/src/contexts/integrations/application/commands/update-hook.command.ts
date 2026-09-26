import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class UpdateHookCommand {
  constructor(
    readonly hookId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
