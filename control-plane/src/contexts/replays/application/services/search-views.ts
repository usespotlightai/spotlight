import type {
  SearchBestDto,
  SearchCandidateDto,
  SearchDetailDto,
  SearchPickDto,
  SearchSummaryDto,
} from '@replays/application/dto/searches.dto';
import { candidatePullRequestView } from '@replays/application/services/config-pull-request-views';
import {
  gainView,
  intervalView,
  modelSpentView,
  moneyView,
  pairTallyView,
} from '@replays/application/services/replay-views';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { frontierOf } from '@replays/domain/services/frontier';
import { type Overfit, overfitOf } from '@replays/domain/services/overfit';
import { rankedOf } from '@replays/domain/services/search-ranking';
import { regressionLimitOf } from '@replays/domain/services/search-regressions';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { SEED_NAME } from '@replays/domain/value-objects/candidate-name.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

type Scores = ReturnType<typeof scoresOf>;

type Scored = Scores['seed'];

const nameOf = (search: Search, candidateId: CandidateId): string =>
  search.proposals.find((each) => each.candidateId.equals(candidateId))?.name
    .value ?? SEED_NAME;

const overfitOfScored = (scored: Scored): Overfit | null =>
  scored.seed ? null : overfitOf(scored.searchedGain, scored.heldOutGain);

const regressionFieldsOf = (
  scored: Scored,
  threshold: ReplayThreshold | null,
) => ({
  regressions: { ...scored.regressions },
  exceedsRegressionLimit: regressionLimitOf(scored.regressions, threshold)
    .exceedsRegressionLimit,
});

const bestOf = (
  search: Search,
  scores: Scores,
  threshold: ReplayThreshold | null,
): SearchBestDto | null => {
  const [best] = rankedOf(
    [scores.seed, ...scores.candidates],
    search.objective,
  );

  return best
    ? {
        candidateId: best.candidateId.value,
        name: nameOf(search, best.candidateId),
        isSeed: best.seed,
        searchScore: best.searchScore,
        searchInterval: intervalView(best.searchInterval),
        heldOutScore: best.heldOutScore,
        heldOutInterval: intervalView(best.heldOutInterval),
        costPerRun: best.costPerRun,
        overfit: overfitOfScored(best),
        ...regressionFieldsOf(best, threshold),
      }
    : null;
};

const scored = (
  search: Search,
  replays: readonly Replay[],
  minGain: number,
) => {
  const scores = scoresOf(search, replays, minGain);

  return {
    scores,
    frontier: frontierOf([scores.seed, ...scores.candidates], search.objective),
  };
};

const pickOf = (search: Search): SearchPickDto | null => {
  const { pick } = search;

  if (!pick) {
    return null;
  }

  return pick.outcome === 'picked'
    ? {
        outcome: 'picked',
        candidateId: pick.candidateId.value,
        name: nameOf(search, pick.candidateId),
        reason: null,
      }
    : {
        outcome: 'declined',
        candidateId: null,
        name: null,
        reason: pick.reason,
      };
};

const summaryOf = (
  search: Search,
  scores: Scores,
  threshold: ReplayThreshold | null,
): SearchSummaryDto => ({
  id: search.id.value,
  lineId: search.station.lineId,
  stationId: search.station.stationId,
  setId: search.setId.value,
  state: search.current,
  stopReason: search.stopReason,
  agent: {
    harness: search.agent.harness,
    model: search.agent.model,
    effort: search.agent.effort,
  },
  budget: {
    iterations: search.budget.iterations,
    perIteration: search.budget.perIteration,
    ceiling: moneyView(search.budget.ceiling),
    concurrency: search.budget.concurrency,
    repeats: search.budget.repeats,
  },
  objective: search.objective,
  spent: moneyView(search.spent),
  iterationsRun: search.iterations.length,
  proposed: search.proposals.length,
  best: bestOf(search, scores, threshold),
  maxRegressions: threshold?.maxRegressions ?? null,
  trigger: search.trigger,
  pick: pickOf(search),
  startedAt: search.startedAt.toISOString(),
  endedAt: search.endedAt?.toISOString() ?? null,
});

const reflectedTaskView = (task: {
  readonly taskId: TaskId;
  readonly originalRunId: RunId;
  readonly replayRunId: RunId;
}) => ({
  taskId: task.taskId.value,
  originalRunId: task.originalRunId.value,
  replayRunId: task.replayRunId.value,
});

export const searchSummaryView = (
  search: Search,
  replays: readonly Replay[],
  minGain: number,
  threshold: ReplayThreshold | null,
): SearchSummaryDto =>
  summaryOf(search, scoresOf(search, replays, minGain), threshold);

const stateOf = (
  replays: readonly Replay[],
  id: ReplayId | null,
): string | null =>
  (id && replays.find((each) => each.id.equals(id))?.current) ?? null;

export const searchDetailView = (
  search: Search,
  replays: readonly Replay[],
  candidates: readonly Candidate[],
  pullRequests: readonly ConfigPullRequest[],
  minGain: number,
  threshold: ReplayThreshold | null,
): SearchDetailDto => {
  const { scores, frontier } = scored(search, replays, minGain);
  const onFrontier = (id: CandidateId) =>
    frontier.some((each) => each.candidateId.equals(id));
  const pullRequestOf = (id: CandidateId) => {
    const found = pullRequests.find((one) => one.candidateId.equals(id));

    return found ? candidatePullRequestView(found) : null;
  };
  const candidateView = (each: Scored): SearchCandidateDto => {
    const candidate =
      candidates.find((one) => one.id.equals(each.candidateId)) ?? null;

    return {
      candidateId: each.candidateId.value,
      name: nameOf(search, each.candidateId),
      isSeed: each.seed,
      iteration: candidate?.search?.iteration ?? null,
      hypothesis: candidate?.search?.hypothesis.value ?? null,
      fingerprint: candidate?.fingerprint.value ?? null,
      changes: each.seed
        ? []
        : (candidate?.changedFrom.changes.map((change) => ({ ...change })) ??
          []),
      replayId: each.replayId.value,
      replayState: stateOf(replays, each.replayId),
      heldOutReplayId: each.heldOutReplayId?.value ?? null,
      heldOutReplayState: stateOf(replays, each.heldOutReplayId),
      searchScore: each.searchScore,
      searchInterval: intervalView(each.searchInterval),
      searchScored: each.searchScored,
      heldOutScore: each.heldOutScore,
      heldOutInterval: intervalView(each.heldOutInterval),
      searchedGain: gainView(each.searchedGain),
      heldOutGain: gainView(each.heldOutGain),
      searchedPairs: each.searchedPairs && pairTallyView(each.searchedPairs),
      heldOutPairs: each.heldOutPairs && pairTallyView(each.heldOutPairs),
      costPerRun: each.costPerRun,
      spent: moneyView(each.spent),
      onFrontier: onFrontier(each.candidateId),
      overfit: overfitOfScored(each),
      ...regressionFieldsOf(each, threshold),
      pullRequest: pullRequestOf(each.candidateId),
    };
  };

  return {
    ...summaryOf(search, scores, threshold),
    split: {
      searchedTasks: search.split.searchedTasks,
      heldOutTasks: search.split.heldOutTasks,
      searched: search.split.searched.map((each) => ({
        runId: each.runId.value,
        taskId: each.taskId.value,
      })),
      heldOut: search.split.heldOut.map((each) => ({
        runId: each.runId.value,
        taskId: each.taskId.value,
      })),
    },
    iterations: search.iterations.map((each) => ({
      number: each.number,
      kind: each.kind,
      runId: each.runId.value,
      state: each.current,
      attempts: each.attempts,
      proposed: each.proposals.map((proposal) => proposal.candidateId.value),
      agentSpent: modelSpentView(each.agentSpent),
      reflection: each.reflects
        ? {
            incumbent: each.incumbent?.value ?? null,
            tasks: each.reflectedOn.map(reflectedTaskView),
            causes: each.causes.map((cause) => ({
              ...reflectedTaskView(cause),
              cause: cause.cause,
              evidence: cause.evidence,
              suggestion: cause.suggestion,
              recordedAt: cause.recordedAt.toISOString(),
            })),
            result: each.result,
            endedSearch: each.endedSearch,
          }
        : null,
    })),
    seed: candidateView(scores.seed),
    candidates: scores.candidates.map(candidateView),
    frontier: frontier.map((each) => each.candidateId.value),
    minGain,
  };
};
