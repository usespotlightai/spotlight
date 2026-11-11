import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { WatchedWorkspacesQuery } from '@identity/application/queries/watched-workspaces.query';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WatchedWorkspacesHandler implements QueryHandlerPort<
  WatchedWorkspacesQuery,
  readonly string[]
> {
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async execute(query: WatchedWorkspacesQuery): Promise<readonly string[]> {
    const person = UserId.of(query.personId);
    const listed = await this.workspaces.listForMember(person);
    const viewable = await this.access.viewableOf(
      person,
      listed.map((each) => WorkspaceId.of(each.id)),
    );

    return viewable.map((each) => each.value);
  }
}
