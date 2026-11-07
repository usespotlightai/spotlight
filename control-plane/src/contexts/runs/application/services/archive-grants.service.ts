import type { ArchiveGrantDto } from '@runs/application/dto/workspace-archive.dto';
import type { WorkspaceArchiveStorePort } from '@runs/application/ports/workspace-archive-store.port';
import type { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import { WorkspaceArchive } from '@runs/domain/aggregates/workspace-archive.aggregate';
import type { WorkspaceArchiveRepository } from '@runs/domain/repositories/workspace-archive.repository';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import type { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import type { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ArchiveGrantRequest {
  readonly workspaceId: WorkspaceId;
  readonly workspaceKey: WorkspaceKey | null;
  readonly grantee: ArchiveGrantee;
  readonly size: number;
  readonly sha256: string;
}

export class ArchiveGrants {
  constructor(
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly holders: ArchiveHolders,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async grant(request: ArchiveGrantRequest): Promise<ArchiveGrantDto> {
    const key = request.workspaceKey;
    const archive = WorkspaceArchive.grant({
      id: WorkspaceArchiveId.of(this.ids.generate()),
      workspaceId: request.workspaceId,
      workspaceKey: key,
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

  async complete(archive: WorkspaceArchive): Promise<void> {
    if (archive.isCompleted) {
      return;
    }

    const stored = await this.store.stored(archive);

    await this.archives.save(archive.complete(stored, this.clock.now()));
  }
}
