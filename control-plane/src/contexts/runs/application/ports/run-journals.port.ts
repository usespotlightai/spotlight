import type {
  RunChanges,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_JOURNALS = Symbol('RUN_JOURNALS');

export interface RunJournalsPort {
  ofRuns(runIds: readonly RunId[]): Promise<RunJournal[]>;

  changesOf(runIds: readonly RunId[]): Promise<RunChanges[]>;
}
