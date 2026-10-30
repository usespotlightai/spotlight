import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';

export interface ArchivingSandbox {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly key: ResumeKey | null;
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
      id: found.id,
      workspaceId: WorkspaceId.of(found.workspaceId),
      key: found.key === null ? null : ResumeKey.of(found.key),
    };
  }
}
