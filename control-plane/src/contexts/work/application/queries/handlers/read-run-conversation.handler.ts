import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunConversationDto } from '@work/application/dto/run-conversation.dto';
import { RunSpendMapper } from '@work/application/mappers/run-spend.mapper';
import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ReadRunConversationQuery } from '@work/application/queries/read-run-conversation.query';

export class ReadRunConversationHandler
  implements
    QueryHandlerPort<ReadRunConversationQuery, RunConversationDto | null>
{
  constructor(
    private readonly runs: RunReaderPort,
    private readonly digests: RunDigestReaderPort,
  ) {}

  async execute(
    query: ReadRunConversationQuery,
  ): Promise<RunConversationDto | null> {
    try {
      const runId = RunId.of(query.runId);
      const found = await this.runs.conversationFor(
        runId,
        UserId.of(query.viewerId),
      );

      if (!found) {
        return null;
      }

      const digest = (await this.digests.forRuns([runId])).get(runId.value);

      return {
        ...found,
        createdAt: found.createdAt.toISOString(),
        notes: found.notes.map((note) => ({
          ...note,
          at: note.at.toISOString(),
        })),
        spend: digest ? RunSpendMapper.toDto(digest) : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
