import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunConversationDto } from '@work/application/dto/run-conversation.dto';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ReadRunConversationQuery } from '@work/application/queries/read-run-conversation.query';

export class ReadRunConversationHandler
  implements
    QueryHandlerPort<ReadRunConversationQuery, RunConversationDto | null>
{
  constructor(private readonly runs: RunReaderPort) {}

  async execute(
    query: ReadRunConversationQuery,
  ): Promise<RunConversationDto | null> {
    try {
      const found = await this.runs.conversationFor(
        RunId.of(query.runId),
        UserId.of(query.viewerId),
      );

      return found
        ? {
            ...found,
            createdAt: found.createdAt.toISOString(),
            notes: found.notes.map((note) => ({
              ...note,
              at: note.at.toISOString(),
            })),
          }
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
