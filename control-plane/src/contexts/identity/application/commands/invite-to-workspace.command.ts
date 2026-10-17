export const MAX_INVITED_AT_ONCE = 50;

export class InviteToWorkspaceCommand {
  constructor(
    readonly slug: string,
    readonly emails: readonly string[],
    readonly role: string,
    readonly teamIds: readonly string[],
    readonly viewerId: string,
  ) {}
}
