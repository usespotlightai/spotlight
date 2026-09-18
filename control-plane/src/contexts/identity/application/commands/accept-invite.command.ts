export class AcceptInviteCommand {
  constructor(
    readonly token: string,
    readonly viewerId: string,
    readonly viewerEmail: string,
  ) {}
}
