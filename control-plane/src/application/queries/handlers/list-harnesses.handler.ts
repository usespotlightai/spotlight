import type { HarnessDto } from '@application/dto/harness.dto';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { BUILT_IN_HARNESSES } from '@domain/value-objects/built-in-harnesses';

/** Known rather than stored, so there is nothing to read. */
export class ListHarnessesHandler
  implements QueryHandlerPort<ListHarnessesQuery, HarnessDto[]>
{
  async execute(): Promise<HarnessDto[]> {
    return BUILT_IN_HARNESSES.map((harness) => ({
      id: harness.id.value,
      name: harness.name.value,
      executable: harness.command.executable,
    }));
  }
}
