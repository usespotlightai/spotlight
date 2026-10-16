export class ChangeStackVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Change stack ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ChangeStackVersionConflictError';
  }
}
