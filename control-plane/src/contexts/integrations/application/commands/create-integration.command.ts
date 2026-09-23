export class CreateIntegrationCommand {
  constructor(
    readonly teamId: string,
    readonly requesterId: string,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
