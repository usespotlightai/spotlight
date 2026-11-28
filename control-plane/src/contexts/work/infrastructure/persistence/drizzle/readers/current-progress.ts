import type { RunProgressPort } from '@runs/application/ports/run-progress.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunWaitingDto } from '@work/application/dto/run-waiting.dto';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
import { RunWaitingMapper } from '@work/application/mappers/run-waiting.mapper';
import {
  type Progress,
  progressOfCurrentRun,
  type RunProgressReading,
} from '@work/domain/value-objects/progress';

export interface CurrentRun {
  readonly reading: RunProgressReading | null;
  readonly waiting: RunWaitingDto | null;
}

// What the current runs are doing, and why the queued ones wait, in one read.
export const currentRunsOf = async (
  progress: RunProgressPort,
  runIds: readonly (string | null)[],
): Promise<(runId: string | null) => CurrentRun> => {
  const ids = [
    ...new Set(runIds.filter((each): each is string => each !== null)),
  ];
  const facts =
    ids.length === 0 ? [] : await progress.progressOf(ids.map(RunId.of));
  const found = new Map(facts.map((each) => [each.runId.value, each]));

  return (runId) => {
    const current = runId === null ? null : (found.get(runId) ?? null);

    return {
      reading: RunReadingMapper.reading(current),
      waiting: RunWaitingMapper.toDto(current?.waiting ?? null),
    };
  };
};

export const progressOfCurrentRuns = async (
  progress: RunProgressPort,
  runIds: readonly (string | null)[],
  answered: boolean,
): Promise<(runId: string | null) => Progress | null> => {
  const currentOf = await currentRunsOf(progress, runIds);

  return (runId) =>
    runId === null
      ? null
      : progressOfCurrentRun(currentOf(runId).reading, answered);
};
