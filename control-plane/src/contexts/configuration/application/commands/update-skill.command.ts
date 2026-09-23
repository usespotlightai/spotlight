export class UpdateSkillCommand {
  constructor(
    readonly skillId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
