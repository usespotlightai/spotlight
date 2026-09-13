export class MoveTaskCommand {
  constructor(
    readonly lineId: string,
    readonly taskId: string,
    readonly stationId: string,
    readonly afterTaskId: string | null,
    readonly viewerId: string,
  ) {}
}
