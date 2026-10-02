import { CandidateAbandonmentDue } from '@replays/domain/events/candidate-abandonment-due.event';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { CandidateWithdrawn } from '@replays/domain/events/candidate-withdrawn.event';
import { ReplayAbandonmentDue } from '@replays/domain/events/replay-abandonment-due.event';
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
import { ReplaySetAbandonmentDue } from '@replays/domain/events/replay-set-abandonment-due.event';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetStationCheckDue } from '@replays/domain/events/replay-set-station-check-due.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopAsked } from '@replays/domain/events/replay-stop-asked.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';

export const REPLAYS_EVENT_TYPES = [
  CandidateAddress,
  CandidateId,
  CandidateName,
  CandidateScoring,
  ChangeChecks,
  EntryJudging,
  EntryMeasures,
  JudgeVerdict,
  ModelSpent,
  ReplayEntry,
  ReplayId,
  ReplaySetEntry,
  ReplaySetId,
  ReplaySetName,
  ReplayStartDetail,
  RunEnd,
  Spend,
  StationAddress,
  StationBlock,
  StationChanges,
  StationFingerprint,
  ReplaySetEntriesChanged,
  ReplaySetDeleted,
  ReplaySetStationGone,
  ReplayStopped,
  ReplayOverBudget,
  ReplayBaselineWanted,
  ReplayJudgingWanted,
  ReplayAbandonmentDue,
  ReplaySetAbandonmentDue,
  CandidateAbandonmentDue,
  ReplaySetStationCheckDue,
  CandidateProposed,
  CandidateWithdrawn,
  ReplayStarted,
  ReplayStopAsked,
] as const;
