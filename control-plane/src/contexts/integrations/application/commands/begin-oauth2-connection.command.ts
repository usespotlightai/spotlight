import type { OAuth2HolderKind } from '@integrations/application/ports/oauth2-linking.port';

export class BeginOAuth2ConnectionCommand {
  constructor(
    readonly teamId: string,
    readonly source: string,
    readonly viewerId: string,
    readonly holder: OAuth2HolderKind,
    readonly back: string | null,
  ) {}
}
