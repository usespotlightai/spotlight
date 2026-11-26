import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';

// What the deployment sets up for every workspace: the provisioner of the platform pool, and the platform egress.
export interface PlatformProvisioning {
  readonly poolSet: boolean;
  readonly egressSet: boolean;
}

export interface WorkspaceRunnerFacts {
  readonly pools: readonly RunnerPool[];
  readonly hosts: readonly RunnerHost[];
  readonly platform: PlatformProvisioning;
  readonly now: Date;
}

export const WorkspaceReadiness = {
  // A runner can start work in the workspace: a pool provisions one on demand, or a host that serves a harness still reports in.
  readyToRun(facts: WorkspaceRunnerFacts): boolean {
    return (
      facts.pools.some((pool) => pool.canProvision(facts.platform.poolSet)) ||
      WorkspaceReadiness.readyForEgress(facts)
    );
  },

  // A runner can start work that needs egress: a pool provisions one with an egress, or a host, whose runners go out through Spotlight, serves a harness.
  readyForEgress(facts: WorkspaceRunnerFacts): boolean {
    return (
      facts.pools.some((pool) => pool.provisionsWithEgress(facts.platform)) ||
      facts.hosts.some((host) => host.servesAHarnessAt(facts.now))
    );
  },

  // The deployment gives the workspace its platform runners: it sets the platform provisioner, and the operator did not disable the workspace's platform pool. The pool can still be on its way, as for a workspace created a moment ago.
  hasPlatformRunners(
    facts: Pick<WorkspaceRunnerFacts, 'pools' | 'platform'>,
  ): boolean {
    return (
      facts.platform.poolSet &&
      !facts.pools.some((pool) => pool.isPlatform && pool.isDisabled)
    );
  },
};
