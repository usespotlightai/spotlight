export class ReopenConversationCommand {
  constructor(
    readonly conversationId: string,
    readonly reopenedBy: string,
  ) {}
}
