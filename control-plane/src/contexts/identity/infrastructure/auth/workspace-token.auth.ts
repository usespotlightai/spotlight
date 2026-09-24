import { DrizzleWorkspaceTokenRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace-token.repository';
import { Inject, Injectable } from '@nestjs/common';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  TOKEN_MINT,
  type TokenMintPort,
} from '@shared-kernel/application/ports/token-mint.port';
import type { WorkspaceTokenIdentityPort } from '@shared-kernel/application/ports/workspace-token-identity.port';
import type { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

@Injectable()
export class WorkspaceTokenAuth implements WorkspaceTokenIdentityPort {
  constructor(
    private readonly tokens: DrizzleWorkspaceTokenRepository,
    @Inject(TOKEN_MINT) private readonly mint: TokenMintPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async identify(bearer: string): Promise<TokenPrincipal | null> {
    const token = await this.tokens.bearing(
      TokenHash.of(this.mint.hash(bearer)),
    );

    return token?.admitsAt(this.clock.now()) ? token.principal : null;
  }
}
