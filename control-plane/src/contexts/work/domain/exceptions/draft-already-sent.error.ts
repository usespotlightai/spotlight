export class DraftAlreadySentError extends Error {
  readonly kind = 'conflict' as const;

  constructor(taskId: string) {
    super(
      `Someone sent the shared draft of task ${taskId} already. The text you see was not sent.`,
    );
    this.name = 'DraftAlreadySentError';
  }
}
