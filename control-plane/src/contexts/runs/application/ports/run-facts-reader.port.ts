import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { WorkspaceArchive } from '@runs/domain/aggregates/workspace-archive.aggregate';
import type { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import type { RunTurnState } from '@runs/domain/value-objects/run-turn.vo';
import type { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_FACTS_READER = Symbol('RUN_FACTS_READER');

export interface RunFactsReaderPort {
  runs(ids: readonly RunId[]): Promise<readonly Run[]>;

  archives(
    ids: readonly WorkspaceArchiveId[],
  ): Promise<readonly WorkspaceArchive[]>;

  turnsSuspendedBefore(
    owner: RequesterOwner,
    turn: RunTurnState,
    before: Date,
    after: { readonly suspendedAt: Date; readonly id: RunId } | null,
    max: number,
  ): Promise<readonly Run[]>;
}
