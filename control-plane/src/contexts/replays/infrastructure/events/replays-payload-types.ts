import { ReplayEntry } from '@replays/domain/entities/replay-entry.entity';
import { ChangeJudged } from '@replays/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@replays/domain/events/change-judging-failed.event';
import { ConfigPullRequestClosed } from '@replays/domain/events/config-pull-request-closed.event';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestMerged } from '@replays/domain/events/config-pull-request-merged.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestReopened } from '@replays/domain/events/config-pull-request-reopened.event';
import { ConfigPullRequestRequested } from '@replays/domain/events/config-pull-request-requested.event';
import { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import { ReplayCeilingReached } from '@replays/domain/events/replay-ceiling-reached.event';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import { ReplaySetCreated } from '@replays/domain/events/replay-set-created.event';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import { ReplayStarted } from '@replays/domain/events/replay-started.event';
import { ReplayStopRequested } from '@replays/domain/events/replay-stop-requested.event';
import { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import { SearchDeleted } from '@replays/domain/events/search-deleted.event';
import { SearchEnded } from '@replays/domain/events/search-ended.event';
import { SearchHoldingOutRequested } from '@replays/domain/events/search-holding-out-requested.event';
import { SearchIterationRequested } from '@replays/domain/events/search-iteration-requested.event';
import { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import { SearchReplaysPlanned } from '@replays/domain/events/search-replays-planned.event';
import { SearchStarted } from '@replays/domain/events/search-started.event';
import { SideBySideJudged } from '@replays/domain/events/side-by-side-judged.event';
import { SideBySideJudgingFailed } from '@replays/domain/events/side-by-side-judging-failed.event';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { ChangeStackId } from '@replays/domain/value-objects/change-stack-id.vo';
import { CheckedChange } from '@replays/domain/value-objects/checked-change.vo';
import { ConfigPullRequestDetail } from '@replays/domain/value-objects/config-pull-request-detail.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { DispatchPool } from '@replays/domain/value-objects/dispatch-pool.vo';
import { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import { EntryMeasures } from '@replays/domain/value-objects/entry-measures.vo';
import {
  EntryPairing,
  PairVerdict,
} from '@replays/domain/value-objects/entry-pairing.vo';
import { FailureCause } from '@replays/domain/value-objects/failure-cause.vo';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { OracleReference } from '@replays/domain/value-objects/oracle-reference.vo';
import { PairingReference } from '@replays/domain/value-objects/pairing-reference.vo';
import { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayStartDetail } from '@replays/domain/value-objects/replay-start-detail.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { ReplayedCandidate } from '@replays/domain/value-objects/replayed-candidate.vo';
import { ReplayedPeriod } from '@replays/domain/value-objects/replayed-period.vo';
import { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { SearchProposal } from '@replays/domain/value-objects/search-proposal.vo';
import { SearchReplay } from '@replays/domain/value-objects/search-replay.vo';
import { SearchRequest } from '@replays/domain/value-objects/search-request.vo';
import { SearchStartDetail } from '@replays/domain/value-objects/search-start-detail.vo';
import { SeedCandidate } from '@replays/domain/value-objects/seed-candidate.vo';
import { SetSnapshot } from '@replays/domain/value-objects/set-snapshot.vo';
import { SetUsers } from '@replays/domain/value-objects/set-users.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
export const REPLAYS_PAYLOAD_TYPES = [
  ChangeJudged,
  ChangeJudgingFailed,
  SideBySideJudged,
  SideBySideJudgingFailed,
  CandidateId,
  CandidateName,
  CandidateScoring,
  ChangeChecks,
  EntryJudging,
  EntryMeasures,
  EntryPairing,
  PairVerdict,
  ReplayEntryConcluded,
  ReplaySideBySideJudgingRequested,
  ReplayPairingRequested,
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
  SearchRequest,
  SearchStartDetail,
  OracleReference,
  PairingReference,
  SetSnapshot,
  ChangeStackId,
  CheckedChange,
  DispatchPool,
  ReplayedCandidate,
  SeedCandidate,
  SetUsers,
  ReplaySetEntriesChanged,
  ReplaySetCreated,
  ReplaySetDeleted,
  ReplaySetStationGone,
  ReplayStopped,
  ReplayCeilingReached,
  ReplayRecheckRequested,
  ReplayRejudgingRequested,
  ReplayBaselineRequested,
  ReplayJudgingRequested,
  ReplayStarted,
  ReplayStopRequested,
  ReplayEnded,
  SearchDeleted,
  SearchEnded,
  SearchHoldingOutRequested,
  SearchIterationRequested,
  SearchStarted,
  SearchCandidatePicked,
  SearchPickDeclined,
  SearchReplaysPlanned,
  StationSearchSkipped,
  ReplayCheckId,
  ReplayThreshold,
  SearchPolicy,
  ReplayedPeriod,
  ReplayCheckStarted,
  StationHashes,
  PlannedLine,
  ConfigPullRequestId,
  ConfigPullRequestDetail,
  ConfigPullRequestReason,
  ConfigPullRequestRequested,
  ConfigPullRequestOpened,
  ConfigPullRequestFailed,
  ConfigPullRequestReopened,
  ConfigPullRequestMerged,
  ConfigPullRequestClosed,
] as const;
