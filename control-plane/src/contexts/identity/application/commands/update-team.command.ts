import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class UpdateTeamCommand {
  constructor(
    readonly teamId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
