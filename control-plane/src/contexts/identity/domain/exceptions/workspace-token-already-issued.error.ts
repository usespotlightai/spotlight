export class WorkspaceTokenAlreadyIssuedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly tokenName: string) {
    super(`The workspace already has a token named ${tokenName}`);
    this.name = 'WorkspaceTokenAlreadyIssuedError';
  }
}
