export class MoveTaskCommand {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly taskId: string,
    readonly stationId: string,
    readonly afterTaskId: string | null,
    readonly viewerId: string,
  ) {}
}
