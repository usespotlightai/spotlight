export class InviteToTeamCommand {
  constructor(
    readonly teamId: string,
    readonly email: string,
    readonly viewerId: string,
  ) {}
}
