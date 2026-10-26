import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class CreateWorkspaceWithTeamCommand {
  constructor(
    readonly name: string,
    readonly slug: string,
    readonly teamName: string,
    readonly survey: {
      readonly jobFunction: string;
      readonly referralSource: string | null;
    },
    readonly actor: Actor,
  ) {}
}
