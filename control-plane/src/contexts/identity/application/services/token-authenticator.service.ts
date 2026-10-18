import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { TokenAuthentication } from '@identity/domain/services/token-authentication';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { WorkspaceTokenIdentityPort } from '@shared-kernel/application/ports/workspace-token-identity.port';
import type { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class TokenAuthenticator implements WorkspaceTokenIdentityPort {
  constructor(
    private readonly tokens: WorkspaceTokenRepository,
    private readonly trusts: WorkspaceTokenTrustRepository,
    private readonly issuer: TokenIssuer,
    private readonly clock: ClockPort,
  ) {}

  async authenticate(bearer: string): Promise<TokenPrincipal | null> {
    const token = await this.tokens.findByHash(
      TokenHash.of(this.issuer.hash(bearer)),
    );

    if (!token) {
      return null;
    }

    const issuedByTrust = token.issuedByTrustId
      ? await this.trusts.find(token.issuedByTrustId)
      : null;

    return TokenAuthentication.authenticates(
      token,
      issuedByTrust,
      this.clock.now(),
    )
      ? token.principal
      : null;
  }
}
