export class DisconnectIntegrationCommand {
  constructor(
    readonly teamId: string,
    readonly integration: string,
    readonly viewerId: string,
  ) {}
}
