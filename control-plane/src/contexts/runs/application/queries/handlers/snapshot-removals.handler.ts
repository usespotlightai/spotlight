import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type { SnapshotRemovalsDto } from '@runs/application/dto/snapshot-removal.dto';
import type { SnapshotRemovalsPort } from '@runs/application/ports/snapshot-removals.port';
import type { SnapshotRemovalsQuery } from '@runs/application/queries/host.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkingCopyStoreName } from '@shared-kernel/domain/value-objects/working-copy-names.vo';

const AT_ONCE = 100;

// The snapshots that a host of a pull pool or trust deletes from its store: only those of its workspace and its store.
export class SnapshotRemovalsHandler implements QueryHandlerPort<
  SnapshotRemovalsQuery,
  SnapshotRemovalsDto
> {
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly removals: SnapshotRemovalsPort,
  ) {}

  async execute(query: SnapshotRemovalsQuery): Promise<SnapshotRemovalsDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        query.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const store = authenticated.workingCopies?.store ?? null;

      if (store === null) {
        return { outcome: 'listed', store: null, removals: [] };
      }

      const due = await this.removals.due(
        authenticated.workspaceId,
        WorkingCopyStoreName.of(store),
        AT_ONCE,
      );

      return {
        outcome: 'listed',
        store,
        removals: due.map((each) => ({
          archiveId: each.archiveId.value,
          snapshot: each.snapshot.value,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
