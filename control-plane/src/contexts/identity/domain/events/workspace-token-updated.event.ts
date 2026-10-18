import type { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export class WorkspaceTokenUpdated implements ConfigurationChanged {
  readonly kind = 'workspace-token.updated';

  constructor(
    readonly tokenId: WorkspaceTokenId,
    readonly workspaceId: WorkspaceId,
    readonly name: TokenName,
    readonly change: ConfigurationChange,
  ) {}
}
