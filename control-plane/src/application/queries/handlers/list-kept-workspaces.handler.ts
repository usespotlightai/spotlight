import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { KeptWorkspaceReaderPort } from '@application/ports/kept-workspace-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListKeptWorkspacesQuery } from '@application/queries/list-kept-workspaces.query';
import { ContinuityKey } from '@domain/services/continuity-key';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

export class ListKeptWorkspacesHandler
  implements QueryHandlerPort<ListKeptWorkspacesQuery, string[]>
{
  constructor(private readonly kept: KeptWorkspaceReaderPort) {}

  async execute(query: ListKeptWorkspacesQuery): Promise<string[]> {
    try {
      const held = await this.kept.listFor(RunnerId.of(query.runnerId));

      return held.map((each) =>
        'chatId' in each
          ? ContinuityKey.forChat(each.chatId)
          : ContinuityKey.for({
              taskId: each.taskId,
              stationId: each.stationId,
            }),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
