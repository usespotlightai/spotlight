import { CandidateDeleted } from '@replays/domain/events/candidate-deleted.event';
import { CandidateDeletionRequested } from '@replays/domain/events/candidate-deletion-requested.event';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { ConfigPullRequestDeletionRequested } from '@replays/domain/events/config-pull-request-deletion-requested.event';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestRequested } from '@replays/domain/events/config-pull-request-requested.event';
import { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import { ReplayCeilingReached } from '@replays/domain/events/replay-ceiling-reached.event';
import { ReplayCheckDeletionRequested } from '@replays/domain/events/replay-check-deletion-requested.event';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { ReplayDeletionRequested } from '@replays/domain/events/replay-deletion-requested.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import { ReplayRejudgingFailed } from '@replays/domain/events/replay-rejudging-failed.event';
import { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetDeletionRequested } from '@replays/domain/events/replay-set-deletion-requested.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetStationCheckRequested } from '@replays/domain/events/replay-set-station-check-requested.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import { ReplayStackRecheckRequested } from '@replays/domain/events/replay-stack-recheck-requested.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopRequested } from '@replays/domain/events/replay-stop-requested.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import { SearchDeletionRequested } from '@replays/domain/events/search-deletion-requested.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutRequested } from '@replays/domain/events/search-holding-out-requested.event';
import { SearchIterationRequested } from '@replays/domain/events/search-iteration-requested.event';
import { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { SearchStopRequested } from '@replays/domain/events/search-stop-requested.event';
import { StationSearchScheduleDeletionRequested } from '@replays/domain/events/station-search-schedule-deletion-requested.event';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidatePath } from '@replays/domain/value-objects/candidate-path.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { ConfigPullRequestDetail } from '@replays/domain/value-objects/config-pull-request-detail.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import {
  EntryPairing,
  PairVerdict,
} from '@replays/domain/value-objects/entry-pairing.vo';
import { FailureCause } from '@replays/domain/value-objects/failure-cause.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayEntry } from '@replays/domain/value-objects/replay-entry.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import { SearchStartDetail } from '@replays/domain/value-objects/search-start-detail.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
export const REPLAYS_PAYLOAD_TYPES = [
  CandidatePath,
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
  ReplaySideBySideJudgingRequested,
  ReplayPairingFailed,
  JudgeVerdict,
  ModelSpent,
  ReplayEntry,
  ReplayId,
  ReplaySetEntry,
  ReplaySetId,
  ReplayStartDetail,
  RunEnd,
  Money,
  StationPath,
  StationBlock,
  StationChanges,
  StationFingerprint,
  PlannedReference,
  HeldOutSplit,
  Hypothesis,
  SearchAgent,
  SearchBudget,
  FailureCause,
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
  ReplayCeilingReached,
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
  SearchStarted,
  SearchCandidatePicked,
  SearchPickDeclined,
  StationSearchSkipped,
  StationSearchScheduleDeletionRequested,
  SearchStopRequested,
  ReplayCheckId,
  ReplayThreshold,
  SearchPolicy,
  ReplayedPeriod,
  ReplayCheckStarted,
  ReplayCheckDeletionRequested,
  StationHashes,
  PlannedLine,
  ConfigPullRequestId,
  ConfigPullRequestDetail,
  ConfigPullRequestReason,
  ConfigPullRequestRequested,
  ConfigPullRequestOpened,
  ConfigPullRequestFailed,
  ConfigPullRequestDeletionRequested,
] as const;
