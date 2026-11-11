export class ResolveConversationCommand {
  constructor(
    readonly conversationId: string,
    readonly resolvedBy: string,
  ) {}
}
