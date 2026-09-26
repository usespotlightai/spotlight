import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteHookCommand {
  constructor(
    readonly hookId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
