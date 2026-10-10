export class RevokeInviteCommand {
  constructor(
    readonly slug: string,
    readonly inviteId: string,
    readonly viewerId: string,
  ) {}
}
