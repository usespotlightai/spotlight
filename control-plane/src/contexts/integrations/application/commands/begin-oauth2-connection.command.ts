export class BeginOAuth2ConnectionCommand {
  constructor(
    readonly teamId: string,
    readonly source: string,
    readonly viewerId: string,
  ) {}
}
