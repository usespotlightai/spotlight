import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class StopSearchCommand {
  constructor(
    readonly teamId: string,
    readonly searchId: string,
    readonly actor: Actor,
  ) {}
}
