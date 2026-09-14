export class DeliverSaidCommand {
  constructor(
    readonly runId: string,
    readonly upTo: number,
  ) {}
}
