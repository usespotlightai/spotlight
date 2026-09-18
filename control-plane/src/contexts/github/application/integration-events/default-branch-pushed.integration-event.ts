export const DEFAULT_BRANCH_PUSHED = 'github.default-branch-pushed.v1';

export type DefaultBranchPushedIntegrationEvent = {
  readonly kind: typeof DEFAULT_BRANCH_PUSHED;
  readonly workspaceId: string;
  readonly repository: string;
  readonly paths: readonly string[];
};
