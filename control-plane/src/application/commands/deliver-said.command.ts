export class DeliverSaidCommand {
  constructor(
    readonly runId: string,
    // Everything said up to and including this note reached the agent.
    readonly upTo: number,
  ) {}
}
