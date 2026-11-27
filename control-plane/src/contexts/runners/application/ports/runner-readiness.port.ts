import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// Hosts that run a harness here, none of which reports in now.
export interface OfflineHarness {
  readonly harness: string;
  readonly hosts: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  // When Spotlight last heard from one of them.
  readonly since: Date;
}

export const RUNNER_READINESS = Symbol('RUNNER_READINESS');

// Whether runners can start work in a workspace. The Runners domain decides it from the pools and hosts of the workspace.
export interface RunnerReadinessPort {
  // A pool provisions a runner on demand, or a host that serves a harness still reports in.
  readyToRun(workspaceId: WorkspaceId): Promise<boolean>;

  // The deployment gives the workspace its platform runners: it sets the platform provisioner, and the operator did not disable the workspace's platform pool. The pool can still be on its way, as for a workspace created a moment ago.
  hasPlatformRunners(workspaceId: WorkspaceId): Promise<boolean>;

  // The harnesses whose work no runner can start until a person acts: every host here that runs one is offline, and no pool of the workspace provisions a runner instead.
  offlineHarnesses(
    workspaceId: WorkspaceId,
  ): Promise<readonly OfflineHarness[]>;

  // A runner can start work that needs egress.
  hasEgressCapableRunner(workspaceId: WorkspaceId): Promise<boolean>;
}
