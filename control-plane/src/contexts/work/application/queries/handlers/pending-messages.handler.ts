import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { PendingMessageDto } from '@work/application/dto/pending-message.dto';
import type { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { Attached } from '@work/application/rendering/attached';
import type { RunWorks } from '@work/application/services/run-works.service';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';

export class PendingMessagesHandler implements QueryHandlerPort<
  PendingMessagesQuery,
  PendingMessageDto[]
> {
  constructor(private readonly works: RunWorks) {}

  async execute(query: PendingMessagesQuery): Promise<PendingMessageDto[]> {
    try {
      const pending = await this.works.pendingFor(query.runId, query.runnerId);

      if (!pending) {
        throw new UnknownRunError(
          `Runner ${query.runnerId} has no lease on run ${query.runId}.`,
        );
      }

      return pending.map((each) => ({
        position: each.position,
        body: Attached.beside(each.body, each.attachments),
        attachments: Attached.shapes(each.attachments),
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
