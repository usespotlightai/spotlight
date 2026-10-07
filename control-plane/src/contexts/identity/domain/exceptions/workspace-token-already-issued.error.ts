export class WorkspaceTokenAlreadyIssuedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(readonly tokenName: string) {
    super(
      `A token named ${tokenName} already exists. Please choose another name.`,
    );
    this.name = 'WorkspaceTokenAlreadyIssuedError';
  }
}
