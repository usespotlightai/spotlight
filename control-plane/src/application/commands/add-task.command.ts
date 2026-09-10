export class AddTaskCommand {
  constructor(
    readonly lineId: string,
    readonly stationId: string,
    readonly title: string,
    readonly description: string | null,
    readonly raisedBy: string,
  ) {}
}
