import type { RunProgressPort } from '@runs/application/ports/run-progress.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
import {
  type Progress,
  progressOfCurrentRun,
  type RunProgressReading,
} from '@work/domain/value-objects/progress';

export const currentRunReadings = async (
  progress: RunProgressPort,
  runIds: readonly (string | null)[],
): Promise<(runId: string | null) => RunProgressReading | null> => {
  const ids = [
    ...new Set(runIds.filter((each): each is string => each !== null)),
  ];
  const facts =
    ids.length === 0 ? [] : await progress.progressOf(ids.map(RunId.of));
  const found = new Map(facts.map((each) => [each.runId.value, each]));

  return (runId) =>
    runId === null ? null : RunReadingMapper.reading(found.get(runId) ?? null);
};

export const progressOfCurrentRuns = async (
  progress: RunProgressPort,
  runIds: readonly (string | null)[],
  answered: boolean,
): Promise<(runId: string | null) => Progress | null> => {
  const readingOf = await currentRunReadings(progress, runIds);

  return (runId) =>
    runId === null ? null : progressOfCurrentRun(readingOf(runId), answered);
};
