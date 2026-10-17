import type { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_GRANTS_REPOSITORY = Symbol('RUN_GRANTS_REPOSITORY');

export interface RunGrantsRepository {
  find(runId: RunId): Promise<RunGrants | null>;

  runsIn(workspaceId: WorkspaceId): Promise<readonly RunId[]>;

  endedBy(
    at: Date,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunId[]>;

  save(grants: RunGrants): Promise<void>;
}
