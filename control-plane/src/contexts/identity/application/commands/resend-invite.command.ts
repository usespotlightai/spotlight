export class ResendInviteCommand {
  constructor(
    readonly slug: string,
    readonly inviteId: string,
    readonly viewerId: string,
  ) {}
}
