export class UserEmailVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(userEmailId: string) {
    super(
      `Email ${userEmailId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'UserEmailVersionConflictError';
  }
}
