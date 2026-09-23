export class DeleteSkillCommand {
  constructor(
    readonly skillId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
  ) {}
}
