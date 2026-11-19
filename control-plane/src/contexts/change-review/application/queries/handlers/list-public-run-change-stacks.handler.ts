import type { PublicChangeStacksDto } from '@change-review/application/dto/change-stack.dto';
import type { ListPublicRunChangeStacksQuery } from '@change-review/application/queries/list-public-run-change-stacks.query';
import type { PublicWorkAccess } from '@change-review/application/services/public-work-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ListPublicRunChangeStacksHandler implements QueryHandlerPort<
  ListPublicRunChangeStacksQuery,
  PublicChangeStacksDto | null
> {
  constructor(private readonly access: PublicWorkAccess) {}

  async execute(
    query: ListPublicRunChangeStacksQuery,
  ): Promise<PublicChangeStacksDto | null> {
    try {
      const stacks = await this.access.stacksOf({
        kind: 'run',
        runId: RunId.of(query.runId),
      });

      return stacks && { stacks };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
