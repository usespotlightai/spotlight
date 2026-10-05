export class DisconnectHostCommand {
  constructor(
    readonly teamId: string,
    readonly source: string,
    readonly viewerId: string,
  ) {}
}
