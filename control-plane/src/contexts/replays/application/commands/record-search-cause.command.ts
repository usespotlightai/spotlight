export class RecordSearchCauseCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly taskId: unknown,
    readonly cause: unknown,
    readonly evidence: unknown,
    readonly suggestion: unknown,
  ) {}
}
