export class UnknownCoAuthorError extends Error {
  readonly kind = 'invalid' as const;

  constructor(userId: string) {
    super(
      `Co-author ${userId} cannot see this workspace, so they cannot have written the draft.`,
    );
    this.name = 'UnknownCoAuthorError';
  }
}
