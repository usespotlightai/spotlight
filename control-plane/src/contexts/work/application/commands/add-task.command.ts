export class AddTaskCommand {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly title: string,
    readonly description: string | null,
    readonly raisedBy: string,
    readonly attachments: readonly string[] = [],
  ) {}
}
