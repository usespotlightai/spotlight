export class InvalidSetupBranchError extends Error {
  readonly violation = 'invalid' as const;

  constructor(branch: string) {
    super(
      `Branch ${branch} is named like a task’s branch. Please name it outside spotlight/, as in spotlight-configuration.`,
    );
    this.name = 'InvalidSetupBranchError';
  }
}
