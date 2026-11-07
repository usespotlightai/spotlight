export class InviteToWorkspaceCommand {
  constructor(
    readonly slug: string,
    readonly email: string,
    readonly role: string,
    readonly teamIds: readonly string[],
    readonly viewerId: string,
  ) {}
}
