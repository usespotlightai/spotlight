import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import type { CandidateKind } from '@replays/domain/value-objects/candidate-kind';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunRow {
  readonly run: RunId;
  readonly station: ReplayedStation;
  readonly candidateName: string;
  readonly candidateKind: CandidateKind;
}

export interface ReplayRunLabelsReaderPort {
  replayRuns(runs: readonly RunId[]): Promise<readonly ReplayRunRow[]>;
}
