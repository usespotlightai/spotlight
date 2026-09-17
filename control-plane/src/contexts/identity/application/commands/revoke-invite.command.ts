export class RevokeInviteCommand {
  constructor(
    readonly teamId: string,
    readonly inviteId: string,
    readonly viewerId: string,
  ) {}
}
