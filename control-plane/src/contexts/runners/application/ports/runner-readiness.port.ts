import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUNNER_READINESS = Symbol('RUNNER_READINESS');

// Whether runners can start work in a workspace. The Runners domain decides it from the pools and hosts of the workspace.
export interface RunnerReadinessPort {
  // A pool provisions a runner on demand, or a host that serves a harness still reports in.
  readyToRun(workspaceId: WorkspaceId): Promise<boolean>;

  // The deployment gives the workspace its platform runners: it sets the platform provisioner, and the operator did not disable the workspace's platform pool. The pool can still be on its way, as for a workspace created a moment ago.
  hasPlatformRunners(workspaceId: WorkspaceId): Promise<boolean>;

  // A runner can start work that needs egress.
  hasEgressCapableRunner(workspaceId: WorkspaceId): Promise<boolean>;
}
