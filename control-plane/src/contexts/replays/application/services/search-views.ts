import type {
  SearchBestDto,
  SearchCandidateDto,
  SearchDetailDto,
  SearchSummaryDto,
} from '@replays/application/dto/searches.dto';
import { candidatePullRequestView } from '@replays/application/services/config-pull-request-views';
import {
  modelSpentView,
  spendView,
} from '@replays/application/services/replay-views';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { frontierOf } from '@replays/domain/services/frontier';
import { rankedOf } from '@replays/domain/services/search-ranking';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { SEED_NAME } from '@replays/domain/value-objects/candidate-name.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';

type Scores = ReturnType<typeof scoresOf>;

type Scored = Scores['seed'];

const nameOf = (search: Search, candidateId: CandidateId): string =>
  search.proposals.find((each) => each.candidateId.equals(candidateId))?.name
    .value ?? SEED_NAME;

const bestOf = (search: Search, scores: Scores): SearchBestDto | null => {
  const [best] = rankedOf([scores.seed, ...scores.candidates]);

  return best
    ? {
        candidateId: best.candidateId.value,
        name: nameOf(search, best.candidateId),
        seed: best.seed,
        searchScore: best.searchScore,
        heldOutScore: best.heldOutScore,
        costPerRun: best.costPerRun,
      }
    : null;
};

const scored = (search: Search, replays: readonly Replay[]) => {
  const scores = scoresOf(search, replays);

  return { scores, frontier: frontierOf([scores.seed, ...scores.candidates]) };
};

const summaryOf = (search: Search, scores: Scores): SearchSummaryDto => ({
  id: search.id.value,
  lineId: search.station.lineId,
  stationId: search.station.stationId,
  setId: search.setId.value,
  state: search.current,
  ending: search.ending,
  agent: {
    harness: search.agent.harness,
    model: search.agent.model,
    effort: search.agent.effort,
  },
  budget: {
    iterations: search.budget.iterations,
    perIteration: search.budget.perIteration,
    ceiling: spendView(search.budget.ceiling),
    concurrency: search.budget.concurrency,
  },
  spent: spendView(search.spent),
  iterationsRun: search.iterations.length,
  proposed: search.proposals.length,
  best: bestOf(search, scores),
  startedAt: search.startedAt.toISOString(),
  endedAt: search.endedAt?.toISOString() ?? null,
});

export const searchSummaryView = (
  search: Search,
  replays: readonly Replay[],
): SearchSummaryDto => summaryOf(search, scoresOf(search, replays));

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
): SearchDetailDto => {
  const { scores, frontier } = scored(search, replays);
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
      seed: each.seed,
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
      searchScored: each.searchScored,
      heldOutScore: each.heldOutScore,
      costPerRun: each.costPerRun,
      spent: spendView(each.spent),
      onFrontier: onFrontier(each.candidateId),
      pullRequest: pullRequestOf(each.candidateId),
    };
  };

  return {
    ...summaryOf(search, scores),
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
      runId: each.runId.value,
      state: each.current,
      attempts: each.attempts,
      proposed: each.proposals.map((proposal) => proposal.candidateId.value),
      agentSpent: modelSpentView(each.agentSpent),
    })),
    seed: candidateView(scores.seed),
    candidates: scores.candidates.map(candidateView),
    frontier: frontier.map((each) => each.candidateId.value),
  };
};
