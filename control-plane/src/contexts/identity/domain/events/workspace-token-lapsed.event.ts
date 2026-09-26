import type { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export class WorkspaceTokenLapsed implements DomainEvent {
  readonly kind = 'workspace-token.lapsed';

  constructor(
    readonly tokenId: WorkspaceTokenId,
    readonly workspaceId: WorkspaceId,
    readonly name: TokenName,
  ) {}
}
