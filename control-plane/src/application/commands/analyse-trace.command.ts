export class AnalyseTraceCommand {
  constructor(
    readonly teamId: string,
    /** The tasks whose traces are to be analysed, one work item each. */
    readonly taskIds: readonly string[],
    /** Who asked, so the analysis comes back to them. */
    readonly requesterId: string,
  ) {}
}
