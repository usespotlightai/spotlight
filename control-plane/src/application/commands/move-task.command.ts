export class MoveTaskCommand {
  constructor(
    readonly lineId: string,
    readonly taskId: string,
    readonly stationId: string,
    readonly afterTaskId: string | null,
    /** Who is moving it: they take unclaimed work into active on the way. */
    readonly viewerId: string,
  ) {}
}
