import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import {
  copiesByOriginal,
  taskSuccessesOf,
} from '@replays/domain/services/replay-results';
import { rankedOf } from '@replays/domain/services/search-ranking';
import { scoresOf } from '@replays/domain/services/search-scores';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';

const MOSTLY_FAILS_BELOW = 0.5;

export interface FailingTasks {
  readonly candidateId: CandidateId;
  readonly tasks: readonly ReflectedTask[];
}

export const failingSearchedTasksOf = (
  search: Search,
  replays: readonly Replay[],
  minGain: number,
): FailingTasks => {
  const scores = scoresOf(search, replays, minGain);
  const [best] = rankedOf(
    [scores.seed, ...scores.candidates].filter((each) => each.finished),
    search.objective,
  );
  const candidateId = best?.candidateId ?? search.seed.candidateId;
  const replayId = best?.replayId ?? search.seed.replay.replayId;
  const bestReplay = replays.find((each) => each.id.equals(replayId));

  if (!bestReplay) {
    return { candidateId, tasks: [] };
  }

  const searched = search.split.searched;
  const searchedRuns = searched.map((each) => each.runId);
  const successes = taskSuccessesOf(bestReplay, searchedRuns);
  const tasks: ReflectedTask[] = [];

  for (const [original, copies] of copiesByOriginal(bestReplay.entries)) {
    const success = successes.get(original);
    const firstFailed = copies.find(
      (each) => each.run !== null && each.succeeded === false,
    );

    if (
      success === undefined ||
      success >= MOSTLY_FAILS_BELOW ||
      !firstFailed?.run ||
      !searched.some(
        (each) =>
          each.runId.equals(firstFailed.original) &&
          each.taskId.equals(firstFailed.taskId),
      )
    ) {
      continue;
    }

    tasks.push(
      ReflectedTask.of({
        taskId: firstFailed.taskId,
        originalRunId: firstFailed.original,
        replayRunId: firstFailed.run,
      }),
    );
  }

  return { candidateId, tasks };
};
