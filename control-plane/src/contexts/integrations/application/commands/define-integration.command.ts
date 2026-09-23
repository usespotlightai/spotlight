export class DefineIntegrationCommand {
  constructor(
    readonly teamId: string,
    readonly requesterId: string,
    readonly definition: unknown,
  ) {}
}
