import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { GitService } from '@work/application/ports/git-gateway.port';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';

export type Cleared =
  | { readonly kind: 'given'; returned(): Promise<void> }
  | { readonly kind: 'asked' }
  | { readonly kind: 'refused'; readonly reason: string };

export type PermissionCleared = Cleared['kind'];

export interface RunWork {
  readonly workspaceId: WorkspaceId;
  deliverUpTo(position: number, at: Date): Promise<void>;
  gave(attachmentId: string): Attachment | null;
  repositoryNamed(
    name: string,
    service: GitService,
  ): Promise<Repository | null>;
  toolContext(): Promise<ToolContext>;
  clearFor(declared: DeclaredTool, call: ToolCall): Promise<Cleared>;
  clearPermission(
    permission: HarnessPermission,
    session: HarnessSession | null,
  ): Promise<PermissionCleared>;
}
