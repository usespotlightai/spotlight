import type { MemoryFileDto } from '@memory/application/dto/memory-file.dto';
import type { LinesPort } from '@memory/application/ports/lines.port';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { ReadMemoryFilesQuery } from '@memory/application/queries/read-memory-files.query';
import { memoryFilesOf } from '@memory/application/rendering/memory-files';
import type { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import type { RunnerMemoryLoader } from '@memory/application/services/runner-memory-loader.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { usesMemories } from '@memory/domain/services/search-memory-access';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class ReadMemoryFilesHandler
  implements QueryHandlerPort<ReadMemoryFilesQuery, MemoryFileDto[]>
{
  constructor(
    private readonly loader: RunnerMemoryLoader,
    private readonly applicable: ApplicableMemories,
    private readonly memories: MemoryRepository,
    private readonly lines: LinesPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadMemoryFilesQuery): Promise<MemoryFileDto[]> {
    try {
      const run = await this.loader.leased(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      if (!usesMemories(run)) {
        return [];
      }

      const applying = await this.applicable.at(run, run.replaysFrom);
      const [lines, replaced] = await Promise.all([
        this.lines.ofTeam(run.teamId),
        this.memories.findAll(
          applying.flatMap((each) =>
            each.supersedes ? [each.supersedes] : [],
          ),
        ),
      ]);
      const names = new Map(
        await Promise.all(
          applying
            .filter(
              (each, at, all) =>
                all.findIndex((one) =>
                  one.approval.by.equals(each.approval.by),
                ) === at,
            )
            .map(
              async (each) =>
                [
                  each.approval.by.value,
                  (await this.people.find(each.approval.by))?.name ?? null,
                ] as const,
            ),
        ),
      );

      return memoryFilesOf(applying, {
        lines,
        replaced: new Map(replaced.map((each) => [each.id.value, each])),
        names,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
