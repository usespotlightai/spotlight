export class NotASetupChatError extends Error {
  readonly kind = 'invalid' as const;

  constructor(chatId: string) {
    super(
      `Chat ${chatId} sets up no configuration, so it opens no setup pull request.`,
    );
    this.name = 'NotASetupChatError';
  }
}
