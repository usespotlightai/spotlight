import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class UpdateSkillCommand {
  constructor(
    readonly skillId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
