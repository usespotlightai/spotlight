export class TakeConversationCommand {
  constructor(
    readonly conversationId: string,
    readonly takenBy: string,
  ) {}
}
