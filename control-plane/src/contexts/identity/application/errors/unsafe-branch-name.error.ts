export class UnsafeBranchNameError extends Error {
  readonly kind = 'invalid' as const;

  constructor(branch: string) {
    super(
      `The default branch ${branch} contains * or :, so an OIDC trust cannot name it exactly. Rename the branch, then set up again.`,
    );
    this.name = 'UnsafeBranchNameError';
  }
}
