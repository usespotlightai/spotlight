export class ReadRunConversationQuery {
  constructor(
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
