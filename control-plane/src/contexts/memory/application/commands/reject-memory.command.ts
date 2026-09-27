export class RejectMemoryCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly runId: string,
    readonly memoryId: string,
    readonly viewerId: string,
  ) {}
}
