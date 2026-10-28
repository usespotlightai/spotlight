import type { CancelReplayRuns } from '@replays/application/services/cancel-replay-runs.service';
import type { CancelSearch } from '@replays/application/services/cancel-search.service';
import type { DeleteConfigPullRequests } from '@replays/application/services/delete-config-pull-requests.service';
import type { DeleteReplayChecks } from '@replays/application/services/delete-replay-checks.service';
import type { DeleteReplays } from '@replays/application/services/delete-replays.service';
import type { DeleteSearches } from '@replays/application/services/delete-searches.service';
import type { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import type { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import type { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import type { KeepReplaySets } from '@replays/application/services/keep-replay-sets.service';
import type { NoticeSearchReflections } from '@replays/application/services/notice-search-reflections.service';
import type { PairReplayEntries } from '@replays/application/services/pair-replay-entries.service';
import type { RecordLineChange } from '@replays/application/services/record-line-change.service';
import type { RecordReplayChangeReview } from '@replays/application/services/record-replay-change-review.service';
import type { RecordReplayPairVerdict } from '@replays/application/services/record-replay-pair-verdict.service';
import type { RecordReplayRunEnding } from '@replays/application/services/record-replay-run-ending.service';
import type { RecordReplayRunUsage } from '@replays/application/services/record-replay-run-usage.service';
import type { RecordReplayVerdict } from '@replays/application/services/record-replay-verdict.service';
import type { RecordSearchProgress } from '@replays/application/services/record-search-progress.service';
import type { RequestReplayJudging } from '@replays/application/services/request-replay-judging.service';
import type { RequestReplayRecheck } from '@replays/application/services/request-replay-recheck.service';
import type { RequestReplayRejudging } from '@replays/application/services/request-replay-rejudging.service';
import type { RequestReplaySideBySideJudging } from '@replays/application/services/request-replay-side-by-side-judging.service';
import type { StartOracleReplay } from '@replays/application/services/start-oracle-replay.service';
import type { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import type { CandidateDeletionRequested } from '@replays/domain/events/candidate-deletion-requested.event';
import type { ConfigPullRequestDeletionRequested } from '@replays/domain/events/config-pull-request-deletion-requested.event';
import type { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import type { ReplayCeilingReached } from '@replays/domain/events/replay-ceiling-reached.event';
import type { ReplayCheckDeletionRequested } from '@replays/domain/events/replay-check-deletion-requested.event';
import type { ReplayDeletionRequested } from '@replays/domain/events/replay-deletion-requested.event';
import type { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import type { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import type { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import type { ReplayPairingFailed } from '@replays/domain/events/replay-pairing-failed.event';
import type { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import type { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import type { ReplayRecheckUnavailable } from '@replays/domain/events/replay-recheck-unavailable.event';
import type { ReplayRejudgingFailed } from '@replays/domain/events/replay-rejudging-failed.event';
import type { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import type { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import type { ReplaySetDeletionRequested } from '@replays/domain/events/replay-set-deletion-requested.event';
import type { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import type { ReplaySetStationCheckRequested } from '@replays/domain/events/replay-set-station-check-requested.event';
import type { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import type { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import type { ReplayStackRecheckRequested } from '@replays/domain/events/replay-stack-recheck-requested.event';
import type { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import type { SearchDeletionRequested } from '@replays/domain/events/search-deletion-requested.event';
import type { SearchEnded } from '@replays/domain/events/search-ended.event';
import type { SearchHoldingOutRequested } from '@replays/domain/events/search-holding-out-requested.event';
import type { SearchIterationRequested } from '@replays/domain/events/search-iteration-requested.event';
import type { SearchReflected } from '@replays/domain/events/search-reflected.event';
import type { SearchStalledUnreflected } from '@replays/domain/events/search-stalled-unreflected.event';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import {
  CHANGE_JUDGED,
  type ChangeJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judged.integration-event';
import {
  CHANGE_JUDGING_FAILED,
  type ChangeJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judging-failed.integration-event';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  REPLAY_CHANGE_CHECKED,
  type ReplayChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-change-checked.integration-event';
import {
  REPLAY_CHANGE_RECHECKED,
  type ReplayChangeRecheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-change-rechecked.integration-event';
import {
  REPLAY_ENDED,
  type ReplayEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-ended.integration-event';
import {
  REPLAY_RUN_USAGE_RECORDED,
  type ReplayRunUsageRecordedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-run-usage-recorded.integration-event';
import {
  REPLAY_STACK_COMPLETED,
  type ReplayStackCompletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-stack-completed.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  SEARCH_RUN_ENDED,
  type SearchRunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/search-run-ended.integration-event';
import {
  SEARCH_RUN_USAGE_RECORDED,
  type SearchRunUsageRecordedIntegrationEvent,
} from '@shared-kernel/application/integration-events/search-run-usage-recorded.integration-event';
import {
  SIDE_BY_SIDE_JUDGED,
  type SideBySideJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/side-by-side-judged.integration-event';
import {
  SIDE_BY_SIDE_JUDGING_FAILED,
  type SideBySideJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/side-by-side-judging-failed.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReplaysReactions {
  readonly ending: RecordReplayRunEnding;
  readonly recordingUsage: RecordReplayRunUsage;
  readonly reviewing: RecordReplayChangeReview;
  readonly requestingJudging: RequestReplayJudging;
  readonly requestingRejudging: RequestReplayRejudging;
  readonly requestingRecheck: RequestReplayRecheck;
  readonly judging: RecordReplayVerdict;
  readonly pairing: PairReplayEntries;
  readonly requestingSideBySideJudging: RequestReplaySideBySideJudging;
  readonly paired: RecordReplayPairVerdict;
  readonly startingPointHolds: HoldSetStartingPoints;
  readonly keeping: KeepReplaySets;
  readonly cancellingRuns: CancelReplayRuns;
  readonly deleting: DeleteReplays;
  readonly lineChanges: RecordLineChange;
  readonly baselines: StartWantedBaseline;
  readonly oracles: StartOracleReplay;
  readonly searching: RecordSearchProgress;
  readonly iterating: DispatchSearchIteration;
  readonly holdingOut: HoldOutSearch;
  readonly cancellingSearches: CancelSearch;
  readonly deletingSearches: DeleteSearches;
  readonly deletingChecks: DeleteReplayChecks;
  readonly deletingPullRequests: DeleteConfigPullRequests;
  readonly noticingReflections: NoticeSearchReflections;
}

const spentOf = (event: {
  readonly spentCosts: readonly { amount: number; currency: string }[];
  readonly unpricedCalls: number;
}): ModelSpent =>
  ModelSpent.of(
    event.spentCosts.map((each) => Money.of(each.amount, each.currency)),
    event.unpricedCalls,
  );

export const replaysSubscribers = (
  reactions: ReplaysReactions,
): readonly DomainEventSubscriber[] => [
  subscribing<ReplayEndedIntegrationEvent>(
    'replays.record-replay-run-ended',
    [REPLAY_ENDED],
    (event) =>
      reactions.ending.ended({
        runId: event.runId,
        outcome: event.outcome,
        failure: event.failure,
        stopped: event.stopped,
        asked: event.asked,
        next: event.next,
      }),
  ),
  subscribing<ReplayRunUsageRecordedIntegrationEvent>(
    'replays.record-replay-run-usage',
    [REPLAY_RUN_USAGE_RECORDED],
    (event) =>
      reactions.recordingUsage.usageRecorded({
        runId: event.runId,
        ms: event.ms,
        steps: event.steps,
        changedLines: event.changedLines,
        cost: event.cost,
        currency: event.currency,
        tokens: {
          input: event.inputTokens,
          output: event.outputTokens,
          cacheRead: event.cacheReadTokens,
          cacheWrite: event.cacheWriteTokens,
        },
      }),
  ),
  subscribing<
    ReplayStackCompletedIntegrationEvent | ReplayChangeCheckedIntegrationEvent
  >(
    'replays.record-replay-change-reviewed',
    [REPLAY_STACK_COMPLETED, REPLAY_CHANGE_CHECKED],
    (event) => reactions.reviewing.reviewed(event.runId),
  ),
  subscribing<ReplayJudgingRequested>(
    'replays.request-replay-run-judging',
    ['replay.judging-requested'],
    (event) => reactions.requestingJudging.requested(event),
  ),
  subscribing<ChangeJudgedIntegrationEvent>(
    'replays.record-replay-run-judged',
    [CHANGE_JUDGED],
    (event) =>
      event.attempt !== 1
        ? Promise.resolve()
        : reactions.judging.judged({
            runId: event.runId,
            scale: event.scale,
            value: event.value,
            claimResults: event.claimResults,
            claims: event.claims,
            passThreshold: event.passThreshold,
            model: event.model,
            referenced: event.referenced,
            reasons: event.reasons,
            guidance: event.guidance,
            spent: spentOf(event),
          }),
  ),
  subscribing<ChangeJudgingFailedIntegrationEvent>(
    'replays.record-replay-run-unjudged',
    [CHANGE_JUDGING_FAILED],
    (event) =>
      event.attempt !== 1
        ? Promise.resolve()
        : reactions.judging.failed(event.runId, event.failure, spentOf(event)),
  ),
  subscribing<ReplayEntryConcluded>(
    'replays.find-replays-to-pair',
    ['replay.entry-concluded'],
    (event) => reactions.pairing.concluded(event),
  ),
  subscribing<ReplayPairingRequested>(
    'replays.pair-replay-entries',
    ['replay.pairing-requested'],
    (event) => reactions.pairing.requested(event.replayId),
  ),
  subscribing<ReplaySideBySideJudgingRequested>(
    'replays.request-side-by-side-judging',
    ['replay.side-by-side-judging-requested'],
    (event) => reactions.requestingSideBySideJudging.requested(event),
  ),
  subscribing<SideBySideJudgedIntegrationEvent>(
    'replays.record-side-by-side-judged',
    [SIDE_BY_SIDE_JUDGED],
    (event) =>
      reactions.paired.paired({
        runId: event.runId,
        otherRunId: event.otherRunId,
        winner: event.winner,
        model: event.model,
        passes: event.passes,
        spent: spentOf(event),
      }),
  ),
  subscribing<SideBySideJudgingFailedIntegrationEvent>(
    'replays.record-side-by-side-unjudged',
    [SIDE_BY_SIDE_JUDGING_FAILED],
    (event) =>
      reactions.paired.failed(
        event.runId,
        event.otherRunId,
        event.failure,
        spentOf(event),
      ),
  ),
  subscribing<ReplayPairingFailed>(
    'replays.record-side-by-side-not-judged',
    ['replay.pairing-failed'],
    (event) => reactions.paired.requestFailed(event),
  ),
  subscribing<ReplayRejudgingRequested>(
    'replays.request-calibration-run-rejudging',
    ['replay.rejudging-requested'],
    (event) => reactions.requestingRejudging.requested(event),
  ),
  subscribing<ChangeJudgedIntegrationEvent>(
    'replays.record-calibration-run-judged-again',
    [CHANGE_JUDGED],
    (event) =>
      event.attempt !== 2
        ? Promise.resolve()
        : reactions.judging.rejudged({
            runId: event.runId,
            scale: event.scale,
            value: event.value,
            claimResults: event.claimResults,
            claims: event.claims,
            passThreshold: event.passThreshold,
            model: event.model,
            referenced: event.referenced,
            reasons: event.reasons,
            guidance: event.guidance,
            spent: spentOf(event),
          }),
  ),
  subscribing<ChangeJudgingFailedIntegrationEvent>(
    'replays.record-calibration-run-unjudged-again',
    [CHANGE_JUDGING_FAILED],
    (event) =>
      event.attempt !== 2
        ? Promise.resolve()
        : reactions.judging.rejudgingFailed(
            event.runId,
            event.failure,
            spentOf(event),
          ),
  ),
  subscribing<ReplayRejudgingFailed>(
    'replays.record-calibration-run-not-judged-again',
    ['replay.rejudging-failed'],
    (event) => reactions.judging.rejudgingRequestFailed(event),
  ),
  subscribing<ReplayRecheckRequested>(
    'replays.request-calibration-run-recheck',
    ['replay.recheck-requested'],
    (event) => reactions.requestingRecheck.requested(event),
  ),
  subscribing<ReplayStackRecheckRequested>(
    'replays.request-calibration-stack-recheck',
    ['replay.stack-recheck-requested'],
    (event) => reactions.requestingRecheck.stack(event),
  ),
  subscribing<ReplayRecheckUnavailable>(
    'replays.record-calibration-run-not-checked-again',
    ['replay.recheck-unavailable'],
    (event) => reactions.reviewing.recheckUnavailable(event),
  ),
  subscribing<ReplayChangeRecheckedIntegrationEvent>(
    'replays.record-calibration-run-rechecked',
    [REPLAY_CHANGE_RECHECKED],
    (event) => reactions.reviewing.rechecked(event.runId),
  ),
  subscribing<
    ReplaySetEntriesChanged | ReplaySetDeleted | ReplaySetStationGone
  >(
    'replays.hold-starting-points-of-replay-set',
    [
      'replay-set.entries-changed',
      'replay-set.deleted',
      'replay-set.station-gone',
    ],
    (event) => reactions.startingPointHolds.changed(event.setId),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'replays.keep-replay-set-of-station',
    [RUN_ENDED],
    (event) =>
      reactions.keeping.onRunEnded(
        event.stationId,
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<ReplayStopped>(
    'replays.stop-runs-of-stopped-replay',
    ['replay.stopped'],
    (event) => reactions.cancellingRuns.stopped(event.runs),
  ),
  subscribing<ReplayCeilingReached>(
    'replays.cancel-runs-of-replay-that-reached-its-ceiling',
    ['replay.ceiling-reached'],
    (event) => reactions.cancellingRuns.ceilingReached(event.runs),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-replays-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<ReplaySetDeleted>(
    'replays.delete-replays-of-deleted-set',
    ['replay-set.deleted'],
    (event) => reactions.deleting.deleteForSet(event.setId, event.workspaceId),
  ),
  subscribing<ReplayDeletionRequested>(
    'replays.delete-replay',
    ['replays.replay-deletion-requested'],
    (event) => reactions.deleting.replay(event.replayId),
  ),
  subscribing<ReplaySetDeletionRequested>(
    'replays.delete-replay-set',
    ['replays.replay-set-deletion-requested'],
    (event) => reactions.deleting.set(event.setId),
  ),
  subscribing<CandidateDeletionRequested>(
    'replays.delete-candidate',
    ['replays.candidate-deletion-requested'],
    (event) => reactions.deleting.candidate(event.candidateId),
  ),
  subscribing<ReplaySetStationCheckRequested>(
    'replays.check-station-of-replay-set',
    ['replays.replay-set-station-check-requested'],
    (event) => reactions.lineChanges.check(event.setId),
  ),
  subscribing<ReplayBaselineRequested>(
    'replays.start-wanted-baseline',
    ['replay.baseline-requested'],
    (event) => reactions.baselines.requested(event),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'replays.record-sets-of-changed-line',
    [LINE_CHANGED],
    (event) => reactions.lineChanges.changed(event.lineId),
  ),
  subscribing<ReplayEnded>(
    'replays.start-oracle-after-baseline',
    ['replays.replay-ended'],
    (event) => reactions.oracles.baselineEnded(event),
  ),
  subscribing<ReplayEnded>(
    'replays.record-search-replay-ended',
    ['replays.replay-ended'],
    (event) => reactions.searching.replayEnded(event),
  ),
  subscribing<SearchRunEndedIntegrationEvent>(
    'replays.record-search-run-ended',
    [SEARCH_RUN_ENDED],
    (event) =>
      reactions.searching.runEnded({
        runId: event.runId,
        outcome: event.outcome,
        asked: event.asked,
        started: event.started,
      }),
  ),
  subscribing<SearchRunUsageRecordedIntegrationEvent>(
    'replays.record-search-run-usage',
    [SEARCH_RUN_USAGE_RECORDED],
    (event) => reactions.searching.usageRecorded(event.runId, spentOf(event)),
  ),
  subscribing<SearchIterationRequested>(
    'replays.dispatch-search-iteration',
    ['replays.search-iteration-requested'],
    (event) => reactions.iterating.requested(event.searchId),
  ),
  subscribing<SearchHoldingOutRequested>(
    'replays.hold-out-search',
    ['replays.search-holding-out-requested'],
    (event) => reactions.holdingOut.requested(event.searchId),
  ),
  subscribing<SearchReflected>(
    'replays.notice-search-reflection',
    ['replays.search-reflected'],
    (event) => reactions.noticingReflections.reflected(event),
  ),
  subscribing<SearchStalledUnreflected>(
    'replays.notice-unreflected-search-stall',
    ['replays.search-stalled-unreflected'],
    (event) => reactions.noticingReflections.stalledUnreflected(event),
  ),
  subscribing<SearchEnded>(
    'replays.cancel-ended-search',
    ['replays.search-ended'],
    (event) => reactions.cancellingSearches.ended(event),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-searches-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deletingSearches.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<SearchDeletionRequested>(
    'replays.delete-search',
    ['replays.search-deletion-requested'],
    (event) => reactions.deletingSearches.search(event.searchId),
  ),
  subscribing<ReplaySetDeleted>(
    'replays.end-search-of-deleted-set',
    ['replay-set.deleted'],
    (event) => reactions.deletingSearches.setGone(event.setId),
  ),
  subscribing<ReplaySetStationGone>(
    'replays.end-search-of-gone-station',
    ['replay-set.station-gone'],
    (event) => reactions.deletingSearches.stationGone(event.setId),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-replay-checks-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deletingChecks.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<ReplaySetDeleted>(
    'replays.delete-replay-checks-of-deleted-set',
    ['replay-set.deleted'],
    (event) =>
      reactions.deletingChecks.deleteForSet(event.setId, event.workspaceId),
  ),
  subscribing<ReplayCheckDeletionRequested>(
    'replays.delete-replay-check',
    ['replays.replay-check-deletion-requested'],
    (event) => reactions.deletingChecks.check(event.checkId),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-config-pull-requests-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deletingPullRequests.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<ConfigPullRequestDeletionRequested>(
    'replays.delete-config-pull-request',
    ['replays.config-pull-request-deletion-requested'],
    (event) => reactions.deletingPullRequests.pullRequest(event.pullRequestId),
  ),
];
