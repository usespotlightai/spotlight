export class MoveTaskCommand {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly taskId: string,
    readonly stationId: string,
    readonly expectedRevision: number,
    readonly afterTaskId: string | null,
    readonly viewerId: string,
  ) {}
}
