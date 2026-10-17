import type { ConnectionOwnerKind } from '@integrations/application/ports/oauth2-linking.port';

export class BeginOAuth2ConnectionCommand {
  constructor(
    readonly teamId: string,
    readonly integration: string,
    readonly viewerId: string,
    readonly owner: ConnectionOwnerKind,
    readonly returnTo: string | null,
  ) {}
}
