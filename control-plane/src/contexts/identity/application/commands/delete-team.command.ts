export class DeleteTeamCommand {
  constructor(
    readonly teamId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
  ) {}
}
