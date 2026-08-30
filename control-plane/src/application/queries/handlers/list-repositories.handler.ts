import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type {
  RepositoryCatalogPort,
  RepositorySummary,
} from '@application/ports/repository-catalog.port';
import type { ListRepositoriesQuery } from '@application/queries/list-repositories.query';

export class ListRepositoriesHandler
  implements QueryHandlerPort<ListRepositoriesQuery, RepositorySummary[]>
{
  constructor(private readonly catalog: RepositoryCatalogPort) {}

  async execute(): Promise<RepositorySummary[]> {
    try {
      return await this.catalog.list();
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
