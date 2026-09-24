export class WorkspaceTokenTermsFixedError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: string,
    readonly because: string,
  ) {
    super(`A workspace token's ${field} ${because}`);
    this.name = 'WorkspaceTokenTermsFixedError';
  }
}
