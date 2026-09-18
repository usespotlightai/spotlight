export class ReadTaskJournalQuery {
  constructor(
    readonly taskId: string,
    readonly viewerId: string,
  ) {}
}
