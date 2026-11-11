import type { ArrivalLedger } from '@notifications/domain/aggregates/arrival-ledger.aggregate';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const ARRIVAL_LEDGER_REPOSITORY = Symbol('ARRIVAL_LEDGER_REPOSITORY');

export interface ArrivalLedgerRepository {
  find(workspaceId: WorkspaceId): Promise<ArrivalLedger | null>;

  nextDueJob(now: Date): Promise<ArrivalLedger | null>;

  add(ledger: ArrivalLedger): Promise<void>;

  save(ledger: ArrivalLedger): Promise<void>;

  remove(ledger: ArrivalLedger): Promise<void>;
}
