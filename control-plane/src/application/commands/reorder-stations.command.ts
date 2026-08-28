export class ReorderStationsCommand {
  constructor(
    readonly lineId: string,
    readonly stationIds: readonly string[],
  ) {}
}
