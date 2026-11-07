import type { ConnectionOwnerKind } from '@integrations/domain/value-objects/connection-owner.vo';

export class BeginOAuth2ConnectionCommand {
  constructor(
    readonly teamId: string,
    readonly integration: string,
    readonly viewerId: string,
    readonly owner: ConnectionOwnerKind,
    readonly returnTo: string | null,
  ) {}
}
