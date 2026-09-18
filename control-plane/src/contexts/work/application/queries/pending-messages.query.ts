export class PendingMessagesQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}
