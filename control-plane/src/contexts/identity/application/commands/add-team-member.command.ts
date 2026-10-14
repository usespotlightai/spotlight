export class AddTeamMemberCommand {
  constructor(
    readonly teamId: string,
    readonly userId: string,
    readonly viewerId: string,
  ) {}
}
