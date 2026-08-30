import type { RunConversationDto } from '@application/dto/run-conversation.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunReaderPort } from '@application/ports/run-reader.port';
import type { ReadRunConversationQuery } from '@application/queries/read-run-conversation.query';
import { RunId } from '@domain/value-objects/run-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

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
