export class RecallMemoryCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly handle: string,
  ) {}
}
