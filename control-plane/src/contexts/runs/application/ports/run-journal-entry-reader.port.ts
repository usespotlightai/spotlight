import type { EgressEnforcement } from '@runs/application/contracts/run-journal.contract';
import type { RunJournalEntryView } from '@runs/application/ports/run-stream.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_JOURNAL_ENTRY_READER = Symbol('RUN_JOURNAL_ENTRY_READER');

export interface RunJournalEntryReaderPort {
  entriesSince(
    runId: RunId,
    attempt: number,
    afterSeq: number,
    max: number,
  ): Promise<RunJournalEntryView[]>;

  egressEnforcementOf(
    runId: RunId,
    attempt: number,
  ): Promise<EgressEnforcement | null>;
}
