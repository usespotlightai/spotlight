import type { WorkingCopyStoresPort } from '@runners/application/ports/working-copy-stores.port';
import type { WorkingCopyArchiveAnswer } from '@runs/application/dto/working-copy-archive.dto';
import { keptStoreOf } from '@runs/application/mappers/kept-store.mapper';
import type { StoredWorkingCopyArchiveQuery } from '@runs/application/queries/stored-working-copy-archive.query';
import type { RestoredArchives } from '@runs/application/services/restored-archives.service';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class StoredWorkingCopyArchiveHandler implements QueryHandlerPort<
  StoredWorkingCopyArchiveQuery,
  WorkingCopyArchiveAnswer
> {
  constructor(
    private readonly runs: RunRepository,
    private readonly restored: RestoredArchives,
    private readonly stores: WorkingCopyStoresPort,
  ) {}

  async execute(
    query: StoredWorkingCopyArchiveQuery,
  ): Promise<WorkingCopyArchiveAnswer> {
    try {
      const runner = RunnerId.of(query.runnerId);
      const run = await this.runs.findById(RunId.of(query.runId));

      if (!run?.isLeasedBy(runner)) {
        return { leased: false };
      }

      const archive = await this.restored.of(run);

      if (!archive) {
        return { leased: true, archive: null };
      }

      const kept = keptStoreOf(await this.stores.ofRunner(runner));

      return {
        leased: true,
        archive: await this.restored.answer(
          archive,
          run.rebases(archive, kept),
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
