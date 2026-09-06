export class AnalyseTraceCommand {
  constructor(
    readonly teamId: string,
    readonly taskIds: readonly string[],
    readonly requesterId: string,
  ) {}
}
