import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunnerSummary {
  readonly id: string;
  readonly name: string;
  readonly harnesses: readonly string[];
  readonly registeredAt: Date;
  readonly lastSeenAt: Date | null;
  readonly revokedAt: Date | null;
}

export const RUNNER_READER = Symbol('RUNNER_READER');

export interface RunnerReaderPort {
  inWorkspace(workspaceId: WorkspaceId): Promise<RunnerSummary[]>;

  anyConnected(workspaceId: WorkspaceId): Promise<boolean>;

  advertisedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
