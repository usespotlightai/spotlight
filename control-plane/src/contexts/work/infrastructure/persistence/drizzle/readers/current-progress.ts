import type { RunProgressPort } from '@runs/application/ports/run-progress.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  type Progress,
  progressOfCurrentRun,
} from '@work/domain/value-objects/progress';

export const progressOfCurrentRuns = async (
  progress: RunProgressPort,
  runIds: readonly (string | null)[],
  answered: boolean,
): Promise<(runId: string | null) => Progress | null> => {
  const ids = [
    ...new Set(runIds.filter((each): each is string => each !== null)),
  ];
  const facts =
    ids.length === 0 ? [] : await progress.progressOf(ids.map(RunId.of));
  const found = new Map(facts.map((each) => [each.runId.value, each]));

  return (runId) =>
    runId === null
      ? null
      : progressOfCurrentRun(found.get(runId) ?? null, answered);
};
