export class InvalidWorkspaceRunnersError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: 'trusts' | 'pools',
    readonly at: number,
    readonly because: string,
  ) {
    super(`Workspace runners ${field}[${at}] ${because}.`);
    this.name = 'InvalidWorkspaceRunnersError';
  }
}
