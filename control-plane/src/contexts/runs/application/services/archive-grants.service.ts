import type { ArchiveGrantDto } from '@runs/application/dto/working-copy-archive.dto';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import type { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import type { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ArchiveGrantRequest {
  readonly workspaceId: WorkspaceId;
  readonly workingCopyKey: WorkingCopyKey | null;
  readonly grantee: ArchiveGrantee;
  readonly size: number;
  readonly sha256: string;
}

export class ArchiveGrants {
  constructor(
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly store: WorkingCopyArchiveStorePort,
    private readonly holders: ArchiveHolders,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async grant(request: ArchiveGrantRequest): Promise<ArchiveGrantDto> {
    const key = request.workingCopyKey;
    const archive = WorkingCopyArchive.grant({
      id: WorkingCopyArchiveId.of(this.ids.generate()),
      workspaceId: request.workspaceId,
      workingCopyKey: key,
      held: key !== null && this.holders.holds(key.owner),
      grantee: request.grantee,
      size: ArchiveSize.of(request.size),
      digest: ArchiveDigest.of(request.sha256),
      at: this.clock.now(),
    });

    const upload = await this.store.grantUpload(archive);

    await this.archives.add(archive);

    return { id: archive.id.value, url: upload.url, headers: upload.headers };
  }

  async complete(archive: WorkingCopyArchive): Promise<void> {
    if (archive.isCompleted) {
      return;
    }

    const stored = await this.store.stored(archive);

    await this.archives.save(archive.complete(stored, this.clock.now()));
  }
}
