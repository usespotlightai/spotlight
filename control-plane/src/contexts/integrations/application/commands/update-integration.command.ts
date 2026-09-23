export class UpdateIntegrationCommand {
  constructor(
    readonly integrationId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
