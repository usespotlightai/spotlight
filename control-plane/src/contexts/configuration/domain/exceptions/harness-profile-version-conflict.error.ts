export class HarnessProfileVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(key: string) {
    super(
      `Harness profile ${key} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'HarnessProfileVersionConflictError';
  }
}
