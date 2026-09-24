import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteHarnessProfileCommand {
  constructor(
    readonly profileId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
