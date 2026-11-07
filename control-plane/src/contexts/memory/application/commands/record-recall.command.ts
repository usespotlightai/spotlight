export class RecordRecallCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly memories: readonly string[],
  ) {}
}
