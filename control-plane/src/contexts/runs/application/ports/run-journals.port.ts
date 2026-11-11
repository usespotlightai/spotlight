import type {
  RunChanges,
  RunJournal,
  RunStepCounts,
} from '@runs/application/contracts/run-journal.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_JOURNALS = Symbol('RUN_JOURNALS');

export interface RunJournalsPort {
  ofRuns(runIds: readonly RunId[]): Promise<RunJournal[]>;

  countsOf(runIds: readonly RunId[]): Promise<Map<string, RunStepCounts>>;

  changesOf(runIds: readonly RunId[]): Promise<RunChanges[]>;
}
