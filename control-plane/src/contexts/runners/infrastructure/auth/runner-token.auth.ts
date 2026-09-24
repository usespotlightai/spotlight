import { Inject, Injectable } from '@nestjs/common';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { DrizzleRunnerTrustRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner-trust.repository';
import type { RunnerIdentityPort } from '@shared-kernel/application/ports/runner-identity.port';
import {
  TOKEN_MINT,
  type TokenMintPort,
} from '@shared-kernel/application/ports/token-mint.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

@Injectable()
export class RunnerTokenAuth implements RunnerIdentityPort {
  constructor(
    private readonly runners: DrizzleRunnerRepository,
    private readonly trusts: DrizzleRunnerTrustRepository,
    @Inject(TOKEN_MINT) private readonly tokens: TokenMintPort,
  ) {}

  async identify(token: string | undefined): Promise<RunnerId | null> {
    if (!token) {
      return null;
    }

    const found = await this.runners.findByTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );

    const trust = found?.trustId ? await this.trusts.find(found.trustId) : null;

    return found?.standsWith(trust) ? found.id : null;
  }
}
