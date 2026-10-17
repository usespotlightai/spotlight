import { CandidateDeleted } from '@replays/domain/events/candidate-deleted.event';
import { CandidateDeletionDue } from '@replays/domain/events/candidate-deletion-due.event';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { ConfigPullRequestDeletionDue } from '@replays/domain/events/config-pull-request-deletion-due.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestWanted } from '@replays/domain/events/config-pull-request-wanted.event';
import { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import { ReplayCheckDeletionDue } from '@replays/domain/events/replay-check-deletion-due.event';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { ReplayDeletionDue } from '@replays/domain/events/replay-deletion-due.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
import { ReplayPairJudgingWanted } from '@replays/domain/events/replay-pair-judging-wanted.event';
import { ReplayPairingDue } from '@replays/domain/events/replay-pairing-due.event';
import { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import { ReplayRecheckWanted } from '@replays/domain/events/replay-recheck-wanted.event';
import { ReplayRejudgingFailed } from '@replays/domain/events/replay-rejudging-failed.event';
import { ReplayRejudgingWanted } from '@replays/domain/events/replay-rejudging-wanted.event';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetDeletionDue } from '@replays/domain/events/replay-set-deletion-due.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetGuardChanged } from '@replays/domain/events/replay-set-guard-changed.event';
import { ReplaySetStationCheckDue } from '@replays/domain/events/replay-set-station-check-due.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplayStackRecheckWanted } from '@replays/domain/events/replay-stack-recheck-wanted.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopAsked } from '@replays/domain/events/replay-stop-asked.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { SearchDeletionDue } from '@replays/domain/events/search-deletion-due.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutWanted } from '@replays/domain/events/search-holding-out-wanted.event';
import { SearchIterationWanted } from '@replays/domain/events/search-iteration-wanted.event';
import { SearchReflected } from '@replays/domain/events/search-reflected.event';
import { SearchStalledUnreflected } from '@replays/domain/events/search-stalled-unreflected.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { SearchStopAsked } from '@replays/domain/events/search-stop-asked.event';
import { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { ChangesGuardDetail } from '@replays/domain/value-objects/changes-guard-detail.vo';
import { ConfigPullRequestDetail } from '@replays/domain/value-objects/config-pull-request-detail.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import {
  EntryPairing,
  PairVerdict,
} from '@replays/domain/value-objects/entry-pairing.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchCause } from '@replays/domain/value-objects/search-cause.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import { SearchStartDetail } from '@replays/domain/value-objects/search-start-detail.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
export const REPLAYS_PAYLOAD_TYPES = [
  CandidateAddress,
  CandidateId,
  CandidateName,
  CandidateScoring,
  ChangeChecks,
  EntryJudging,
  EntryMeasures,
  EntryPairing,
  PairVerdict,
  JudgeCriteria,
  ReplayEntryConcluded,
  ReplayPairingDue,
  ReplayPairJudgingWanted,
  ReplayPairingFailed,
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
  PlannedReference,
  HeldOutSplit,
  Hypothesis,
  SearchAgent,
  SearchBudget,
  SearchCause,
  ReflectedTask,
  SearchId,
  SearchIteration,
  SearchProposal,
  SearchReplay,
  SearchStartDetail,
  ReplaySetEntriesChanged,
  ReplaySetDeleted,
  ReplaySetStationGone,
  ReplayStopped,
  ReplayOverBudget,
  ReplayRecheckUnavailable,
  ReplayRecheckWanted,
  ReplayRejudgingFailed,
  ReplayRejudgingWanted,
  ReplayStackRecheckWanted,
  ReplayBaselineWanted,
  ReplayJudgingWanted,
  ReplayDeletionDue,
  ReplaySetDeletionDue,
  CandidateDeletionDue,
  ReplaySetStationCheckDue,
  CandidateProposed,
  CandidateDeleted,
  ReplayStarted,
  ReplayStopAsked,
  ReplayEnded,
  SearchDeletionDue,
  SearchEnded,
  SearchHoldingOutWanted,
  SearchIterationWanted,
  SearchReflected,
  SearchStalledUnreflected,
  SearchStarted,
  SearchStopAsked,
  ReplayCheckId,
  ReplayThreshold,
  ReplayedPeriod,
  ReplayCheckStarted,
  ReplayCheckDeletionDue,
  StationDigests,
  PlannedLine,
  ChangesGuardDetail,
  ReplaySetGuardChanged,
  ConfigPullRequestId,
  ConfigPullRequestDetail,
  ConfigPullRequestReason,
  ConfigPullRequestWanted,
  ConfigPullRequestOpened,
  ConfigPullRequestDeletionDue,
] as const;
