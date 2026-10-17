import { CandidateDeleted } from '@replays/domain/events/candidate-deleted.event';
import { CandidateDeletionRequested } from '@replays/domain/events/candidate-deletion-requested.event';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { ConfigPullRequestDeletionRequested } from '@replays/domain/events/config-pull-request-deletion-requested.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestRequested } from '@replays/domain/events/config-pull-request-requested.event';
import { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import { ReplayCheckDeletionRequested } from '@replays/domain/events/replay-check-deletion-requested.event';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { ReplayDeletionRequested } from '@replays/domain/events/replay-deletion-requested.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
import { ReplayPairJudgingRequested } from '@replays/domain/events/replay-pair-judging-requested.event';
import { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import { ReplayRejudgingFailed } from '@replays/domain/events/replay-rejudging-failed.event';
import { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetDeletionRequested } from '@replays/domain/events/replay-set-deletion-requested.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetGuardChanged } from '@replays/domain/events/replay-set-guard-changed.event';
import { ReplaySetStationCheckRequested } from '@replays/domain/events/replay-set-station-check-requested.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplayStackRecheckRequested } from '@replays/domain/events/replay-stack-recheck-requested.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopRequested } from '@replays/domain/events/replay-stop-requested.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { SearchDeletionRequested } from '@replays/domain/events/search-deletion-requested.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutRequested } from '@replays/domain/events/search-holding-out-requested.event';
import { SearchIterationRequested } from '@replays/domain/events/search-iteration-requested.event';
import { SearchReflected } from '@replays/domain/events/search-reflected.event';
import { SearchStalledUnreflected } from '@replays/domain/events/search-stalled-unreflected.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { SearchStopRequested } from '@replays/domain/events/search-stop-requested.event';
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
  ReplayPairingRequested,
  ReplayPairJudgingRequested,
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
  ReplayRecheckRequested,
  ReplayRejudgingFailed,
  ReplayRejudgingRequested,
  ReplayStackRecheckRequested,
  ReplayBaselineRequested,
  ReplayJudgingRequested,
  ReplayDeletionRequested,
  ReplaySetDeletionRequested,
  CandidateDeletionRequested,
  ReplaySetStationCheckRequested,
  CandidateProposed,
  CandidateDeleted,
  ReplayStarted,
  ReplayStopRequested,
  ReplayEnded,
  SearchDeletionRequested,
  SearchEnded,
  SearchHoldingOutRequested,
  SearchIterationRequested,
  SearchReflected,
  SearchStalledUnreflected,
  SearchStarted,
  SearchStopRequested,
  ReplayCheckId,
  ReplayThreshold,
  ReplayedPeriod,
  ReplayCheckStarted,
  ReplayCheckDeletionRequested,
  StationDigests,
  PlannedLine,
  ChangesGuardDetail,
  ReplaySetGuardChanged,
  ConfigPullRequestId,
  ConfigPullRequestDetail,
  ConfigPullRequestReason,
  ConfigPullRequestRequested,
  ConfigPullRequestOpened,
  ConfigPullRequestDeletionRequested,
] as const;
