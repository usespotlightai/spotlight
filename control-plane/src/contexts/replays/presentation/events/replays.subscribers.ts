import type { CancelReplayRuns } from '@replays/application/services/cancel-replay-runs.service';
import type { CancelSearch } from '@replays/application/services/cancel-search.service';
import type { DeleteChangeJudgings } from '@replays/application/services/delete-change-judgings.service';
import type { DeleteConfigPullRequests } from '@replays/application/services/delete-config-pull-requests.service';
import type { DeleteLineSearchBudgets } from '@replays/application/services/delete-line-search-budgets.service';
import type { DeleteReplayChecks } from '@replays/application/services/delete-replay-checks.service';
import type { DeleteReplays } from '@replays/application/services/delete-replays.service';
import type { DeleteSearches } from '@replays/application/services/delete-searches.service';
import type { DeleteSideBySideJudgings } from '@replays/application/services/delete-side-by-side-judgings.service';
import type { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import type { FollowConfigPullRequests } from '@replays/application/services/follow-config-pull-requests.service';
import type { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import type { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import type { KeepReplaySets } from '@replays/application/services/keep-replay-sets.service';
import type { NoticeSearchResults } from '@replays/application/services/notice-search-results.service';
import type { PairReplayEntries } from '@replays/application/services/pair-replay-entries.service';
import type { PickSearchCandidates } from '@replays/application/services/pick-search-candidates.service';
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
import type { SearchSchedules } from '@replays/application/services/search-schedules.service';
import type { StartCheckReplays } from '@replays/application/services/start-check-replays.service';
import type { StartOracleReplay } from '@replays/application/services/start-oracle-replay.service';
import type { StartSearchReplays } from '@replays/application/services/start-search-replays.service';
import type { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import type { TurnOffSearches } from '@replays/application/services/turn-off-searches.service';
import type { ChangeJudged } from '@replays/domain/events/change-judged.event';
import type { ChangeJudgingFailed } from '@replays/domain/events/change-judging-failed.event';
import type { ConfigPullRequestClosed } from '@replays/domain/events/config-pull-request-closed.event';
import type { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import type { ConfigPullRequestMerged } from '@replays/domain/events/config-pull-request-merged.event';
import type { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import type { ConfigPullRequestReopened } from '@replays/domain/events/config-pull-request-reopened.event';
import type { ReplayBaselineRequested } from '@replays/domain/events/replay-baseline-requested.event';
import type { ReplayCeilingReached } from '@replays/domain/events/replay-ceiling-reached.event';
import type { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import type { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import type { ReplayEntryConcluded } from '@replays/domain/events/replay-entry-concluded.event';
import type { ReplayJudgingRequested } from '@replays/domain/events/replay-judging-requested.event';
import type { ReplayPairingRequested } from '@replays/domain/events/replay-pairing-requested.event';
import type { ReplayRecheckRequested } from '@replays/domain/events/replay-recheck-requested.event';
import type { ReplayRejudgingRequested } from '@replays/domain/events/replay-rejudging-requested.event';
import type { ReplaySetCreated } from '@replays/domain/events/replay-set-created.event';
import type { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import type { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import type { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import type { ReplaySideBySideJudgingRequested } from '@replays/domain/events/replay-side-by-side-judging-requested.event';
import type { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import type { SearchCandidatePicked } from '@replays/domain/events/search-candidate-picked.event';
import type { SearchDeleted } from '@replays/domain/events/search-deleted.event';
import type { SearchEnded } from '@replays/domain/events/search-ended.event';
import type { SearchHoldingOutRequested } from '@replays/domain/events/search-holding-out-requested.event';
import type { SearchIterationRequested } from '@replays/domain/events/search-iteration-requested.event';
import type { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import type { SearchReplaysPlanned } from '@replays/domain/events/search-replays-planned.event';
import type { SideBySideJudged } from '@replays/domain/events/side-by-side-judged.event';
import type { SideBySideJudgingFailed } from '@replays/domain/events/side-by-side-judging-failed.event';
import type { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  PULL_REQUEST_REOPENED,
  type PullRequestReopenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-reopened.integration-event';
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
  STATION_ALERT_FIRED,
  type StationAlertFiredIntegrationEvent,
} from '@shared-kernel/application/integration-events/station-alert-fired.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
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
  readonly deletingChangeJudgings: DeleteChangeJudgings;
  readonly deletingSideBySideJudgings: DeleteSideBySideJudgings;
  readonly deletingBudgets: DeleteLineSearchBudgets;
  readonly startingSearchReplays: StartSearchReplays;
  readonly startingCheckReplays: StartCheckReplays;
  readonly noticingResults: NoticeSearchResults;
  readonly picking: PickSearchCandidates;
  readonly schedules: SearchSchedules;
  readonly turningOff: TurnOffSearches;
  readonly following: FollowConfigPullRequests;
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
    ['replays.replay-judging-requested'],
    (event) => reactions.requestingJudging.requested(event),
    { callsOut: true },
  ),
  subscribing<ChangeJudged>(
    'replays.record-replay-run-judged',
    ['replays.change-judging-judged'],
    (event) =>
      event.attempt !== 1
        ? Promise.resolve()
        : reactions.judging.judged(event.runId, event.verdict, event.spent),
  ),
  subscribing<ChangeJudgingFailed>(
    'replays.record-replay-run-unjudged',
    ['replays.change-judging-failed'],
    (event) =>
      event.attempt !== 1
        ? Promise.resolve()
        : reactions.judging.failed(
            event.runId,
            event.failure.code,
            event.spent,
          ),
  ),
  subscribing<ReplayEntryConcluded>(
    'replays.find-replays-to-pair',
    ['replays.replay-entry-concluded'],
    (event) => reactions.pairing.concluded(event),
    { callsOut: true },
  ),
  subscribing<ReplayPairingRequested>(
    'replays.pair-replay-entries',
    ['replays.replay-pairing-requested'],
    (event) => reactions.pairing.paired(event.replayId),
    { callsOut: true },
  ),
  subscribing<ReplaySideBySideJudgingRequested>(
    'replays.request-side-by-side-judging',
    ['replays.replay-side-by-side-judging-requested'],
    (event) => reactions.requestingSideBySideJudging.requested(event),
    { callsOut: true },
  ),
  subscribing<SideBySideJudged>(
    'replays.record-side-by-side-judged',
    ['replays.side-by-side-judging-judged'],
    (event) =>
      reactions.paired.paired(
        event.runId,
        event.otherRunId,
        event.verdict,
        event.spent,
      ),
  ),
  subscribing<SideBySideJudgingFailed>(
    'replays.record-side-by-side-unjudged',
    ['replays.side-by-side-judging-failed'],
    (event) =>
      reactions.paired.failed(
        event.runId,
        event.otherRunId,
        event.failure.code,
        event.spent,
      ),
  ),
  subscribing<ReplayRejudgingRequested>(
    'replays.request-calibration-run-rejudging',
    ['replays.replay-rejudging-requested'],
    (event) => reactions.requestingRejudging.requested(event),
    { callsOut: true },
  ),
  subscribing<ChangeJudged>(
    'replays.record-calibration-run-judged-again',
    ['replays.change-judging-judged'],
    (event) =>
      event.attempt !== 2
        ? Promise.resolve()
        : reactions.judging.rejudged(event.runId, event.verdict, event.spent),
  ),
  subscribing<ChangeJudgingFailed>(
    'replays.record-calibration-run-unjudged-again',
    ['replays.change-judging-failed'],
    (event) =>
      event.attempt !== 2
        ? Promise.resolve()
        : reactions.judging.rejudgingFailed(
            event.runId,
            event.failure.code,
            event.spent,
          ),
  ),
  subscribing<ReplayRecheckRequested>(
    'replays.request-calibration-run-recheck',
    ['replays.replay-recheck-requested'],
    (event) => reactions.requestingRecheck.requested(event),
    { callsOut: true },
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
      'replays.replay-set-entries-changed',
      'replays.replay-set-deleted',
      'replays.replay-set-station-gone',
    ],
    (event) => reactions.startingPointHolds.changed(event.setId),
    { callsOut: true },
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
  subscribing<ReplaySetCreated>(
    'replays.schedule-searches-of-created-set',
    ['replays.replay-set-created'],
    (event) => reactions.keeping.onSetCreated(event.setId),
  ),
  subscribing<ReplayStopped>(
    'replays.stop-runs-of-stopped-replay',
    ['replays.replay-stopped'],
    (event) => reactions.cancellingRuns.stopped(event.runs),
    { callsOut: true },
  ),
  subscribing<ReplayCeilingReached>(
    'replays.cancel-runs-of-replay-that-reached-its-ceiling',
    ['replays.replay-ceiling-reached'],
    (event) => reactions.cancellingRuns.ceilingReached(event.runs),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-replay-sets-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deleting.setsOfTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-candidates-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deleting.candidatesOfTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<ReplaySetDeleted>(
    'replays.delete-replays-of-deleted-set',
    ['replays.replay-set-deleted'],
    (event) => reactions.deleting.replaysOfSet(event.setId),
    { callsOut: true },
  ),
  subscribing<ReplayBaselineRequested>(
    'replays.start-wanted-baseline',
    ['replays.replay-baseline-requested'],
    (event) => reactions.baselines.requested(event),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'replays.record-sets-at-stations-gone-from-changed-line',
    [LINE_CHANGED],
    (event) => reactions.lineChanges.stationsLeft(LineId.of(event.lineId)),
    { callsOut: true },
  ),
  subscribing<LineChangedIntegrationEvent>(
    'replays.stop-stale-oracles-of-changed-line',
    [LINE_CHANGED],
    (event) =>
      reactions.lineChanges.staleOraclesStopped(LineId.of(event.lineId)),
    { callsOut: true },
  ),
  subscribing<ReplayEnded>(
    'replays.start-oracle-after-baseline',
    ['replays.replay-ended'],
    (event) => reactions.oracles.baselineEnded(event),
    { callsOut: true },
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
  subscribing<SearchEnded>(
    'replays.pick-candidate-of-finished-search',
    ['replays.search-ended'],
    (event) => reactions.picking.searchEnded(event),
  ),
  subscribing<SearchCandidatePicked>(
    'replays.open-config-pull-request-of-picked-candidate',
    ['replays.search-candidate-picked'],
    (event) => reactions.picking.candidatePicked(event),
  ),
  subscribing<ConfigPullRequestOpened>(
    'replays.notice-config-pull-request-opened',
    ['replays.config-pull-request-opened'],
    (event) => reactions.noticingResults.pullRequestOpened(event),
    { callsOut: true },
  ),
  subscribing<ConfigPullRequestFailed>(
    'replays.notice-config-pull-request-failed',
    ['replays.config-pull-request-failed'],
    (event) => reactions.noticingResults.pullRequestFailed(event),
    { callsOut: true },
  ),
  subscribing<ConfigPullRequestOpened>(
    'replays.close-stale-config-pull-request-once-opened',
    ['replays.config-pull-request-opened'],
    (event) => reactions.following.check(event.pullRequestId),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'replays.close-stale-config-pull-requests-of-changed-line',
    [LINE_CHANGED],
    (event) => reactions.following.lineChanged(LineId.of(event.lineId)),
  ),
  subscribing<PullRequestClosedIntegrationEvent>(
    'replays.record-config-pull-request-closed',
    [PULL_REQUEST_CLOSED],
    (event) =>
      reactions.following.closedOnGitHub({
        workspaceId: WorkspaceId.of(event.workspaceId),
        repository: Repository.of(event.repository),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        gitHubId: event.gitHubId,
        merged: event.merged,
        at: event.closedAt ? new Date(event.closedAt) : null,
      }),
  ),
  subscribing<PullRequestReopenedIntegrationEvent>(
    'replays.record-config-pull-request-reopened',
    [PULL_REQUEST_REOPENED],
    (event) =>
      reactions.following.reopenedOnGitHub({
        workspaceId: WorkspaceId.of(event.workspaceId),
        repository: Repository.of(event.repository),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        gitHubId: event.gitHubId,
        at: event.reopenedAt ? new Date(event.reopenedAt) : null,
      }),
  ),
  subscribing<ConfigPullRequestMerged>(
    'replays.record-station-improved-by-merge',
    ['replays.config-pull-request-merged'],
    (event) => reactions.schedules.improved(event),
  ),
  subscribing<ConfigPullRequestClosed>(
    'replays.remember-config-rejected-by-person',
    ['replays.config-pull-request-closed'],
    (event) => reactions.schedules.rejected(event),
  ),
  subscribing<ConfigPullRequestReopened>(
    'replays.forget-rejection-of-reopened-config',
    ['replays.config-pull-request-reopened'],
    (event) => reactions.schedules.reopened(event),
  ),
  subscribing<SearchPickDeclined>(
    'replays.advise-on-search-stalled-outside-config',
    ['replays.search-pick-declined'],
    (event) => reactions.noticingResults.pickDeclined(event),
    { callsOut: true },
  ),
  subscribing<SearchPickDeclined>(
    'replays.notice-requesters-of-declined-search',
    ['replays.search-pick-declined'],
    (event) => reactions.noticingResults.requestersOfDecline(event),
    { callsOut: true },
  ),
  subscribing<SearchCandidatePicked>(
    'replays.notice-requesters-of-other-pick',
    ['replays.search-candidate-picked'],
    (event) => reactions.noticingResults.requestersOfOtherPick(event),
    { callsOut: true },
  ),
  subscribing<SearchEnded>(
    'replays.notice-requesters-of-stopped-search',
    ['replays.search-ended'],
    (event) => reactions.noticingResults.requestersOfStop(event),
    { callsOut: true },
  ),
  subscribing<StationSearchSkipped>(
    'replays.notice-skipped-station-search',
    ['replays.station-search-skipped'],
    (event) => reactions.noticingResults.skipped(event),
    { callsOut: true },
  ),
  subscribing<StationAlertFiredIntegrationEvent>(
    'replays.search-station-after-alert',
    [STATION_ALERT_FIRED],
    (event) => reactions.schedules.alerted(StationId.of(event.stationId)),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'replays.look-again-at-searches-of-changed-line',
    [LINE_CHANGED],
    (event) => reactions.schedules.lineChanged(LineId.of(event.lineId)),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'replays.stop-searches-turned-off-in-changed-line',
    [LINE_CHANGED],
    (event) => reactions.turningOff.lineChanged(LineId.of(event.lineId)),
  ),
  subscribing<ReplaySetDeleted | ReplaySetStationGone>(
    'replays.delete-search-schedule-of-gone-set',
    ['replays.replay-set-deleted', 'replays.replay-set-station-gone'],
    (event) => reactions.schedules.setGone(event.setId),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-search-schedules-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.schedules.ofTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<SearchEnded>(
    'replays.cancel-ended-search',
    ['replays.search-ended'],
    (event) => reactions.cancellingSearches.ended(event),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-searches-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deletingSearches.ofTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<SearchDeleted>(
    'replays.cancel-run-of-deleted-search',
    ['replays.search-deleted'],
    (event) => reactions.deletingSearches.cancelRunOf(event),
    { callsOut: true },
  ),
  subscribing<ReplaySetStationGone>(
    'replays.end-search-of-gone-station',
    ['replays.replay-set-station-gone'],
    (event) => reactions.deletingSearches.stationGone(event.setId),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-replay-checks-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deletingChecks.ofTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<ReplaySetDeleted>(
    'replays.delete-replay-checks-of-deleted-set',
    ['replays.replay-set-deleted'],
    (event) => reactions.deletingChecks.ofSet(event.setId),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-config-pull-requests-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deletingPullRequests.ofTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-change-judgings-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deletingChangeJudgings.ofTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-side-by-side-judgings-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deletingSideBySideJudgings.ofTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'replays.delete-line-search-budgets-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deletingBudgets.ofTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<SearchReplaysPlanned>(
    'replays.start-planned-search-replays',
    ['replays.search-replays-planned'],
    (event) => reactions.startingSearchReplays.planned(event),
    { callsOut: true },
  ),
  subscribing<ReplayCheckStarted>(
    'replays.start-replay-of-started-check',
    ['replays.replay-check-started'],
    (event) => reactions.startingCheckReplays.started(event),
    { callsOut: true },
  ),
];
