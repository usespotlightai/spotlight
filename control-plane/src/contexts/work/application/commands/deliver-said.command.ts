export class DeliverSaidCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly upTo: number,
  ) {}
}
