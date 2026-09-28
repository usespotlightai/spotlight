import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { BearerAdmission } from '@identity/domain/services/bearer-admission';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { WorkspaceTokenIdentityPort } from '@shared-kernel/application/ports/workspace-token-identity.port';
import type { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class TokenBearers implements WorkspaceTokenIdentityPort {
  constructor(
    private readonly tokens: WorkspaceTokenRepository,
    private readonly trusts: WorkspaceTokenTrustRepository,
    private readonly mint: TokenMintPort,
    private readonly clock: ClockPort,
  ) {}

  async identify(bearer: string): Promise<TokenPrincipal | null> {
    const token = await this.tokens.bearing(
      TokenHash.of(this.mint.hash(bearer)),
    );

    if (!token) {
      return null;
    }

    const mintedThrough = token.mintedThrough
      ? await this.trusts.find(token.mintedThrough)
      : null;

    return BearerAdmission.admits(token, mintedThrough, this.clock.now())
      ? token.principal
      : null;
  }
}
