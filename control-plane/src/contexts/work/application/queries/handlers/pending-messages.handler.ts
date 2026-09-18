import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { PendingMessageDto } from '@work/application/dto/pending-message.dto';
import type { HeldRunReaderPort } from '@work/application/ports/held-run-reader.port';
import type { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { Attached } from '@work/application/rendering/attached';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';

export class PendingMessagesHandler
  implements QueryHandlerPort<PendingMessagesQuery, PendingMessageDto[]>
{
  constructor(private readonly held: HeldRunReaderPort) {}

  async execute(query: PendingMessagesQuery): Promise<PendingMessageDto[]> {
    try {
      const pending = await this.held.pendingFor(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      if (!pending) {
        throw new UnknownRunError(
          `runner ${query.runnerId} holds no run ${query.runId}`,
        );
      }

      return pending.map((each) => ({
        position: each.position,
        body: Attached.beside(each.body, each.attachments),
        attachments: Attached.shapes(each.attachments),
      }));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
