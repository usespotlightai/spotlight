import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class GuardChangesCommand {
  constructor(
    readonly teamId: string,
    readonly setId: string,
    readonly guards: boolean,
    readonly actor: Actor,
  ) {}
}
