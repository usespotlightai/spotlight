import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { KeptWorkspaceReaderPort } from '@work/application/ports/kept-workspace-reader.port';
import type { ListKeptWorkspacesQuery } from '@work/application/queries/list-kept-workspaces.query';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';

export class ListKeptWorkspacesHandler
  implements QueryHandlerPort<ListKeptWorkspacesQuery, string[]>
{
  constructor(private readonly kept: KeptWorkspaceReaderPort) {}

  async execute(query: ListKeptWorkspacesQuery): Promise<string[]> {
    try {
      const held = await this.kept.listFor(RunnerId.of(query.runnerId));

      return held.map(
        (each) =>
          ('chatId' in each
            ? ContinuityKey.forChat(each.chatId)
            : ContinuityKey.for({
                taskId: each.taskId,
                stationId: each.stationId,
              })
          ).value,
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
