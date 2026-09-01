import type { HarnessDto } from '@application/dto/harness.dto';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import type { HarnessRepository } from '@domain/repositories/harness.repository';

/** Known rather than stored, so there is nothing to read. */
export class ListHarnessesHandler
  implements QueryHandlerPort<ListHarnessesQuery, HarnessDto[]>
{
  constructor(private readonly harnesses: HarnessRepository) {}

  async execute(): Promise<HarnessDto[]> {
    return this.harnesses.all().map((harness) => ({
      id: harness.id.value,
      name: harness.name.value,
      executable: harness.command.executable,
    }));
  }
}
