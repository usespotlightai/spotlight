export class RenameTeamCommand {
  constructor(
    readonly teamId: string,
    readonly name: string,
    readonly viewerId: string,
  ) {}
}
