export class SecretTargetConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(secretName: string, takenBy: string, target: string) {
    super(
      `Secrets ${secretName} and ${takenBy} are both injected in ${target} for the same host. A request can contain only one of them.`,
    );
    this.name = 'SecretTargetConflictError';
  }
}
