export class RefreshIntegrationSpecCommand {
  constructor(
    readonly teamId: string,
    readonly integration: string,
  ) {}
}
