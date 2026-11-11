export class RecallMemoryQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly handle: string,
  ) {}
}
