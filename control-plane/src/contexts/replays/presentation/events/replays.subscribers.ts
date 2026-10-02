import type { AbandonConfigPullRequests } from '@replays/application/services/abandon-config-pull-requests.service';
import type { AbandonReplayChecks } from '@replays/application/services/abandon-replay-checks.service';
import type { AbandonReplays } from '@replays/application/services/abandon-replays.service';
import type { AbandonSearches } from '@replays/application/services/abandon-searches.service';
import type { AskForReplayJudging } from '@replays/application/services/ask-for-replay-judging.service';
import type { DispatchSearchIteration } from '@replays/application/services/dispatch-search-iteration.service';
import type { HoldOutSearch } from '@replays/application/services/hold-out-search.service';
import type { HoldSetStartingPoints } from '@replays/application/services/hold-set-starting-points.service';
import type { LetReplayRunsGo } from '@replays/application/services/let-replay-runs-go.service';
import type { LetSearchGo } from '@replays/application/services/let-search-go.service';
import type { NoteLineRedefined } from '@replays/application/services/note-line-redefined.service';
import type { NoteReplayChangeReviewed } from '@replays/application/services/note-replay-change-reviewed.service';
import type { NoteReplayDigested } from '@replays/application/services/note-replay-digested.service';
import type { NoteReplayEnded } from '@replays/application/services/note-replay-ended.service';
import type { NoteReplayJudged } from '@replays/application/services/note-replay-judged.service';
import type { NoteSearchProgress } from '@replays/application/services/note-search-progress.service';
import type { StartWantedBaseline } from '@replays/application/services/start-wanted-baseline.service';
import type { CandidateAbandonmentDue } from '@replays/domain/events/candidate-abandonment-due.event';
import type { ConfigPullRequestAbandonmentDue } from '@replays/domain/events/config-pull-request-abandonment-due.event';
import type { ReplayAbandonmentDue } from '@replays/domain/events/replay-abandonment-due.event';
import type { ReplayBaselineWanted } from '@replays/domain/events/replay-baseline-wanted.event';
import type { ReplayCheckAbandonmentDue } from '@replays/domain/events/replay-check-abandonment-due.event';
import type { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import type { ReplayJudgingWanted } from '@replays/domain/events/replay-judging-wanted.event';
import type { ReplayOverBudget } from '@replays/domain/events/replay-over-budget.event';
import type { ReplaySetAbandonmentDue } from '@replays/domain/events/replay-set-abandonment-due.event';
import type { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import type { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import type { ReplaySetStationCheckDue } from '@replays/domain/events/replay-set-station-check-due.event';
import type { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import type { ReplayStopped } from '@replays/domain/events/replay-stopped.event';
import type { SearchAbandonmentDue } from '@replays/domain/events/search-abandonment-due.event';
import type { SearchEnded } from '@replays/domain/events/search-ended.event';
import type { SearchHoldingOutWanted } from '@replays/domain/events/search-holding-out-wanted.event';
import type { SearchIterationWanted } from '@replays/domain/events/search-iteration-wanted.event';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import {
  CHANGE_JUDGED,
  type ChangeJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judged.integration-event';
import {
  CHANGE_JUDGING_FAILED,
  type ChangeJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judging-failed.integration-event';
import {
  LINE_REDEFINED,
  type LineRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-redefined.integration-event';
import {
  REPLAY_CHANGE_CHECKED,
  type ReplayChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-change-checked.integration-event';
import {
  REPLAY_DIGESTED,
  type ReplayDigestedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-digested.integration-event';
import {
  REPLAY_ENDED,
  type ReplayEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-ended.integration-event';
import {
  REPLAY_STACK_SETTLED,
  type ReplayStackSettledIntegrationEvent,
} from '@shared-kernel/application/integration-events/replay-stack-settled.integration-event';
import {
  SEARCH_RUN_DIGESTED,
  type SearchRunDigestedIntegrationEvent,
} from '@shared-kernel/application/integration-events/search-run-digested.integration-event';
import {
  SEARCH_RUN_ENDED,
  type SearchRunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/search-run-ended.integration-event';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReplaysReactions {
  readonly ending: NoteReplayEnded;
  readonly digesting: NoteReplayDigested;
  readonly reviewing: NoteReplayChangeReviewed;
  readonly asking: AskForReplayJudging;
  readonly judging: NoteReplayJudged;
  readonly holding: HoldSetStartingPoints;
  readonly lettingGo: LetReplayRunsGo;
  readonly abandoning: AbandonReplays;
  readonly redefining: NoteLineRedefined;
  readonly baselines: StartWantedBaseline;
  readonly searching: NoteSearchProgress;
  readonly iterating: DispatchSearchIteration;
  readonly holdingOut: HoldOutSearch;
  readonly lettingSearchesGo: LetSearchGo;
  readonly abandoningSearches: AbandonSearches;
  readonly abandoningChecks: AbandonReplayChecks;
  readonly abandoningPullRequests: AbandonConfigPullRequests;
}

const spentOf = (event: {
  readonly spentCosts: readonly { amount: number; currency: string }[];
  readonly unpricedCalls: number;
}): ModelSpent =>
  ModelSpent.of(
    event.spentCosts.map((each) => Spend.of(each.amount, each.currency)),
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
  subscribing<ReplayDigestedIntegrationEvent>(
    'replays.record-replay-run-digested',
    [REPLAY_DIGESTED],
    (event) =>
      reactions.digesting.digested({
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
    ReplayStackSettledIntegrationEvent | ReplayChangeCheckedIntegrationEvent
  >(
    'replays.record-replay-change-reviewed',
    [REPLAY_STACK_SETTLED, REPLAY_CHANGE_CHECKED],
    (event) => reactions.reviewing.reviewed(event.runId),
  ),
  subscribing<ReplayJudgingWanted>(
    'replays.ask-to-judge-replay-run',
    ['replay.judging-wanted'],
    (event) => reactions.asking.wanted(event),
  ),
  subscribing<ChangeJudgedIntegrationEvent>(
    'replays.record-replay-run-judged',
    [CHANGE_JUDGED],
    (event) =>
      reactions.judging.judged({
        runId: event.runId,
        scale: event.scale,
        value: event.value,
        model: event.model,
        referenced: event.referenced,
        reasons: event.reasons,
        spent: spentOf(event),
      }),
  ),
  subscribing<ChangeJudgingFailedIntegrationEvent>(
    'replays.record-replay-run-unjudged',
    [CHANGE_JUDGING_FAILED],
    (event) =>
      reactions.judging.failed(event.runId, event.failure, spentOf(event)),
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
    (event) => reactions.holding.changed(event.setId),
  ),
  subscribing<ReplayStopped>(
    'replays.stop-runs-of-stopped-replay',
    ['replay.stopped'],
    (event) => reactions.lettingGo.stopped(event.runs),
  ),
  subscribing<ReplayOverBudget>(
    'replays.withdraw-runs-of-replay-over-budget',
    ['replay.over-budget'],
    (event) => reactions.lettingGo.overBudget(event.runs),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'replays.abandon-replays-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.abandoning.ofTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<ReplaySetDeleted>(
    'replays.abandon-replays-of-deleted-set',
    ['replay-set.deleted'],
    (event) => reactions.abandoning.ofSet(event.setId, event.workspaceId),
  ),
  subscribing<ReplayAbandonmentDue>(
    'replays.abandon-replay',
    ['replays.replay-abandonment-due'],
    (event) => reactions.abandoning.replay(event.replayId),
  ),
  subscribing<ReplaySetAbandonmentDue>(
    'replays.abandon-replay-set',
    ['replays.replay-set-abandonment-due'],
    (event) => reactions.abandoning.set(event.setId),
  ),
  subscribing<CandidateAbandonmentDue>(
    'replays.abandon-candidate',
    ['replays.candidate-abandonment-due'],
    (event) => reactions.abandoning.candidate(event.candidateId),
  ),
  subscribing<ReplaySetStationCheckDue>(
    'replays.check-station-of-replay-set',
    ['replays.replay-set-station-check-due'],
    (event) => reactions.redefining.check(event.setId),
  ),
  subscribing<ReplayBaselineWanted>(
    'replays.start-wanted-baseline',
    ['replay.baseline-wanted'],
    (event) => reactions.baselines.wanted(event),
  ),
  subscribing<LineRedefinedIntegrationEvent>(
    'replays.note-sets-of-redefined-line',
    [LINE_REDEFINED],
    (event) => reactions.redefining.redefined(event.lineId),
  ),
  subscribing<ReplayEnded>(
    'replays.note-search-replay-ended',
    ['replays.replay-ended'],
    (event) => reactions.searching.replayEnded(event),
  ),
  subscribing<SearchRunEndedIntegrationEvent>(
    'replays.note-search-run-ended',
    [SEARCH_RUN_ENDED],
    (event) =>
      reactions.searching.runEnded({
        runId: event.runId,
        outcome: event.outcome,
        asked: event.asked,
        started: event.started,
      }),
  ),
  subscribing<SearchRunDigestedIntegrationEvent>(
    'replays.note-search-run-digested',
    [SEARCH_RUN_DIGESTED],
    (event) => reactions.searching.digested(event.runId, spentOf(event)),
  ),
  subscribing<SearchIterationWanted>(
    'replays.dispatch-search-iteration',
    ['replays.search-iteration-wanted'],
    (event) => reactions.iterating.wanted(event.searchId),
  ),
  subscribing<SearchHoldingOutWanted>(
    'replays.hold-out-search',
    ['replays.search-holding-out-wanted'],
    (event) => reactions.holdingOut.wanted(event.searchId),
  ),
  subscribing<SearchEnded>(
    'replays.let-ended-search-go',
    ['replays.search-ended'],
    (event) => reactions.lettingSearchesGo.ended(event),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'replays.abandon-searches-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.abandoningSearches.ofTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<SearchAbandonmentDue>(
    'replays.abandon-search',
    ['replays.search-abandonment-due'],
    (event) => reactions.abandoningSearches.search(event.searchId),
  ),
  subscribing<ReplaySetDeleted>(
    'replays.end-search-of-deleted-set',
    ['replay-set.deleted'],
    (event) => reactions.abandoningSearches.setGone(event.setId),
  ),
  subscribing<ReplaySetStationGone>(
    'replays.end-search-of-gone-station',
    ['replay-set.station-gone'],
    (event) => reactions.abandoningSearches.stationGone(event.setId),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'replays.abandon-replay-checks-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.abandoningChecks.ofTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<ReplaySetDeleted>(
    'replays.abandon-replay-checks-of-deleted-set',
    ['replay-set.deleted'],
    (event) => reactions.abandoningChecks.ofSet(event.setId, event.workspaceId),
  ),
  subscribing<ReplayCheckAbandonmentDue>(
    'replays.abandon-replay-check',
    ['replays.replay-check-abandonment-due'],
    (event) => reactions.abandoningChecks.check(event.checkId),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'replays.abandon-config-pull-requests-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.abandoningPullRequests.ofTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<ConfigPullRequestAbandonmentDue>(
    'replays.abandon-config-pull-request',
    ['replays.config-pull-request-abandonment-due'],
    (event) =>
      reactions.abandoningPullRequests.pullRequest(event.pullRequestId),
  ),
];
