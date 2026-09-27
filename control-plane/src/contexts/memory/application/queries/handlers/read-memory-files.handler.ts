import type { MemoryFileDto } from '@memory/application/dto/memory-file.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { ReadMemoryFilesQuery } from '@memory/application/queries/read-memory-files.query';
import { memoryFilesOf } from '@memory/application/rendering/memory-files';
import type { RunnerMemoryAtHand } from '@memory/application/services/runner-memory-at-hand.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadMemoryFilesHandler
  implements QueryHandlerPort<ReadMemoryFilesQuery, MemoryFileDto[]>
{
  constructor(
    private readonly atHand: RunnerMemoryAtHand,
    private readonly memories: MemoryRepository,
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadMemoryFilesQuery): Promise<MemoryFileDto[]> {
    try {
      const held = await this.atHand.held(query.runId, query.runnerId);
      const applying = (await this.memories.mayReach(held)).filter(
        (each) => each.standing === 'stands' && each.scope.appliesAt(held),
      );
      const [lines, replaced] = await Promise.all([
        this.work.linesOf(held.teamId),
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
                  await this.people.nameOf(each.approval.by),
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
      rethrowAsFault(error);
    }
  }
}
