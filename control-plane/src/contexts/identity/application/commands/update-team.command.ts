export class UpdateTeamCommand {
  constructor(
    readonly teamId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
