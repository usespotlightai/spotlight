export class RecallMemoriesQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly words: string,
  ) {}
}
