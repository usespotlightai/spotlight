import type { INestApplication } from '@nestjs/common';
import { SetHealths } from '@replays/application/services/set-healths.service';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { frontierOf } from '@replays/domain/services/frontier';
import { overfitOf } from '@replays/domain/services/overfit';
import { rankedOf } from '@replays/domain/services/search-ranking';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleSearchRepository } from '@replays/infrastructure/persistence/drizzle/repositories/search.repository';

const SEED = 'seed';

type Scored = ReturnType<typeof scoresOf>['seed'];

const nameOf = (search: Search, candidateId: CandidateId): string =>
  search.proposals.find((each) => each.candidateId.equals(candidateId))?.name
    .value ?? SEED;

const overfitOfScored = (scored: Scored) =>
  scored.seed ? null : overfitOf(scored.searchedGain, scored.heldOutGain);

export const searchReadOf = async (app: INestApplication, id: string) => {
  const search = await app.get(DrizzleSearchRepository).find(SearchId.of(id));

  if (!search) {
    throw new Error(`Search ${id} not found.`);
  }

  const replays = await app.get(DrizzleReplayRepository).ofSearch(search.id);
  const { minGain } = await app.get(SetHealths).standardAt(search.station);
  const scores = scoresOf(search, replays, minGain);
  const frontier = frontierOf(
    [scores.seed, ...scores.candidates],
    search.objective,
  );
  const [best] = rankedOf(
    [scores.seed, ...scores.candidates],
    search.objective,
  );
  const candidateOf = (each: Scored) => ({
    candidateId: each.candidateId.value,
    name: nameOf(search, each.candidateId),
    replayId: each.replayId.value,
    heldOutReplayId: each.heldOutReplayId?.value ?? null,
    searchScore: each.searchScore,
    searchScored: each.searchScored,
    costPerRun: each.costPerRun,
    heldOutScore: each.heldOutScore,
    onFrontier: frontier.some((one) =>
      one.candidateId.equals(each.candidateId),
    ),
    overfit: overfitOfScored(each),
  });
  const { pick } = search;

  return {
    state: search.current,
    stopReason: search.stopReason,
    objective: search.objective,
    trigger: search.trigger,
    spent: { amount: search.spent.amount },
    split: {
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
      runId: each.runId?.value ?? null,
      state: each.current,
      reflection: each.reflects
        ? {
            tasks: each.reflectedOn.map((task) => ({
              taskId: task.taskId.value,
              originalRunId: task.originalRunId.value,
              replayRunId: task.replayRunId.value,
            })),
            causes: each.causes.map((cause) => ({
              taskId: cause.taskId.value,
              cause: cause.cause,
              replayRunId: cause.replayRunId.value,
            })),
            result: each.result,
            endedSearch: each.endedSearch,
          }
        : null,
    })),
    seed: candidateOf(scores.seed),
    candidates: scores.candidates.map(candidateOf),
    frontier: frontier.map((each) => each.candidateId.value),
    pick: pick
      ? pick.outcome === 'picked'
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
          }
      : null,
    best: best
      ? {
          name: nameOf(search, best.candidateId),
          overfit: overfitOfScored(best),
        }
      : null,
  };
};
