import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  RunChanges,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';

export const RUN_JOURNALS = Symbol('RUN_JOURNALS');

export interface RunJournalsPort {
  ofRuns(runIds: readonly RunId[]): Promise<RunJournal[]>;

  changesOf(runIds: readonly RunId[]): Promise<RunChanges[]>;
}
