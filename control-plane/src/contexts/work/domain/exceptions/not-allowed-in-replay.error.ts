export class NotAllowedInReplayError extends Error {
  readonly kind = 'conflict' as const;

  constructor(what: string) {
    super(
      `A replay may not ${what}: it leaves nothing behind but its own result`,
    );
    this.name = 'NotAllowedInReplayError';
  }
}
