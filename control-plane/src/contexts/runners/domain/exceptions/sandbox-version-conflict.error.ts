export class SandboxVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(sandboxId: string) {
    super(
      `Sandbox ${sandboxId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'SandboxVersionConflictError';
  }
}
