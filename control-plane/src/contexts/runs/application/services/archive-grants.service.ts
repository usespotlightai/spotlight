import type { ArchiveGrantRequest } from '@runs/application/commands/working-copy-archive.commands';
import type { ArchiveGrantDto } from '@runs/application/dto/working-copy-archive.dto';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import type { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import {
  type ArchiveLocation,
  archiveLocationOf,
  type KeptStore,
} from '@runs/domain/value-objects/archive-location.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ArchiveGrantOrder {
  readonly workspaceId: WorkspaceId;
  readonly workingCopyKey: WorkingCopyKey | null;
  readonly grantee: ArchiveGrantee;
  readonly requested: ArchiveGrantRequest;
  // The store of the grantee's pool or trust, as Spotlight knows it, and where the working copy was restored from.
  readonly kept: KeptStore | null;
  readonly restoring: ArchiveLocation | null;
}

export class ArchiveGrants {
  constructor(
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly store: WorkingCopyArchiveStorePort,
    private readonly holders: ArchiveHolders,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async grant(order: ArchiveGrantOrder): Promise<ArchiveGrantDto> {
    const key = order.workingCopyKey;
    const archive = WorkingCopyArchive.grant({
      id: WorkingCopyArchiveId.of(this.ids.generate()),
      workspaceId: order.workspaceId,
      workingCopyKey: key,
      held: key !== null && this.holders.holds(key.owner),
      grantee: order.grantee,
      location: archiveLocationOf(order.requested, order.kept, order.restoring),
      at: this.clock.now(),
    });

    const { snapshot } = archive;

    if (snapshot) {
      await this.archives.add(archive);

      return { id: archive.id.value, snapshot: { name: snapshot.value } };
    }

    const upload = await this.store.grantUpload(archive);

    await this.archives.add(archive);

    return { id: archive.id.value, url: upload.url, headers: upload.headers };
  }

  async complete(archive: WorkingCopyArchive): Promise<void> {
    if (archive.isCompleted) {
      return;
    }

    const stored =
      archive.location.kind === 'spotlight'
        ? await this.store.stored(archive)
        : null;

    await this.archives.save(archive.complete(stored, this.clock.now()));
  }
}
