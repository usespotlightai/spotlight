export class MarkConversationReadCommand {
  constructor(
    readonly conversationId: string,
    readonly readBy: string,
  ) {}
}
