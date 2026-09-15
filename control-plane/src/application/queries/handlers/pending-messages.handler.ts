import type { PendingMessageDto } from '@application/dto/pending-message.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { PendingMessagesQuery } from '@application/queries/pending-messages.query';
import { Attached } from '@application/rendering/attached';
import type { RunWorks } from '@application/services/run-works.service';

export class PendingMessagesHandler
  implements QueryHandlerPort<PendingMessagesQuery, PendingMessageDto[]>
{
  constructor(private readonly works: RunWorks) {}

  async execute(query: PendingMessagesQuery): Promise<PendingMessageDto[]> {
    try {
      const worked = await this.works.of(query.runId);

      return (worked?.work?.pending() ?? []).map((each) => ({
        position: each.position,
        body: Attached.beside(each.body, each.attachments),
        attachments: Attached.shapes(each.attachments),
      }));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
