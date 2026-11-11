import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ArchivingSandbox {
  readonly id: SandboxId;
  readonly workspaceId: WorkspaceId;
  readonly key: WorkingCopyKey | null;
}

export class SandboxArchives {
  constructor(private readonly sandboxes: SandboxesPort) {}

  async authenticated(
    sandboxId: string,
    token: string | undefined,
  ): Promise<ArchivingSandbox | null> {
    const found = await this.sandboxes.authenticate(token);

    if (found?.id !== sandboxId) {
      return null;
    }

    return {
      id: SandboxId.of(found.id),
      workspaceId: WorkspaceId.of(found.workspaceId),
      key: found.key === null ? null : WorkingCopyKey.parse(found.key),
    };
  }
}
