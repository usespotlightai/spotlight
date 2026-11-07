import { RunReadModel } from '@runs/application/services/run-read-model.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const runReadModelOver = (runs: {
  findById(id: RunId): Promise<Run | null>;
}): RunReadModel =>
  new RunReadModel({
    runs: async (ids) =>
      (await Promise.all(ids.map((id) => runs.findById(id)))).filter(
        (each): each is Run => each !== null,
      ),
    archives: async () => [],
    turnsSuspendedBefore: async () => [],
  });
