export class DeleteIntegrationCommand {
  constructor(
    readonly integrationId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
  ) {}
}
