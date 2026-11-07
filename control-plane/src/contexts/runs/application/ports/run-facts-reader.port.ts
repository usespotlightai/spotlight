import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { RequesterOwner } from '@runs/domain/value-objects/run-requester.vo';
import type { RunTurnState } from '@runs/domain/value-objects/run-turn.vo';
import type { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_FACTS_READER = Symbol('RUN_FACTS_READER');

export interface RunFactsReaderPort {
  runs(ids: readonly RunId[]): Promise<readonly Run[]>;

  archives(
    ids: readonly WorkingCopyArchiveId[],
  ): Promise<readonly WorkingCopyArchive[]>;

  turnsSuspendedBefore(
    owner: RequesterOwner,
    turn: RunTurnState,
    before: Date,
    after: { readonly suspendedAt: Date; readonly id: RunId } | null,
    max: number,
  ): Promise<readonly Run[]>;
}
