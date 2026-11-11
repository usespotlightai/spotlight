export class RunStopRequestedQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}
