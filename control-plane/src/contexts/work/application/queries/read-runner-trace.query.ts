export class ReadRunnerTraceQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly taskId: string,
  ) {}
}
