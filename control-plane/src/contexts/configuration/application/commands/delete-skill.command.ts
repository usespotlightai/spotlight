import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteSkillCommand {
  constructor(
    readonly skillId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
