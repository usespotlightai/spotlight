import type { EditorLeasesPort } from '@runners/application/ports/editor-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { EditorConnectionStateDto } from '@work/application/dto/editor-connection.dto';
import type { ReadEditorConnectionQuery } from '@work/application/queries/editor-connection.query';
import type { EditorTargets } from '@work/application/services/editor-targets.service';

export class ReadEditorConnectionHandler implements QueryHandlerPort<
  ReadEditorConnectionQuery,
  EditorConnectionStateDto | null
> {
  constructor(
    private readonly targets: EditorTargets,
    private readonly leases: EditorLeasesPort,
  ) {}

  async execute(
    query: ReadEditorConnectionQuery,
  ): Promise<EditorConnectionStateDto | null> {
    try {
      const found = await this.targets.workingCopyOf(
        UserId.of(query.viewerId),
        query.target,
        query.workspaceSlug,
      );

      return found
        ? {
            connected: await this.leases.isHeld(
              found.workspaceId.value,
              found.key,
            ),
          }
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
