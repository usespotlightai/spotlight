export class RecallMemoriesCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly words: string,
  ) {}
}
