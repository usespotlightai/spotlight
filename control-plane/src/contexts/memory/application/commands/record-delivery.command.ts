export class RecordDeliveryCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly handles: readonly string[],
  ) {}
}
