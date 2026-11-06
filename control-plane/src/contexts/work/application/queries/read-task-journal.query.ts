export class ListTaskJournalRunsQuery {
  constructor(
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}

export class ReadTaskJournalQuery {
  constructor(
    readonly taskId: string,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
