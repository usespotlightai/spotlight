import type { RunnerAuthPort } from '@application/ports/runner-auth.port';
import {
  TOKEN_MINT,
  type TokenMintPort,
} from '@application/ports/token-mint.port';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { DrizzleRunnerRepository } from '@infrastructure/persistence/drizzle/repositories/runner.repository';
import { Inject, Injectable } from '@nestjs/common';

/**
 * Looks the bearer token up by its hash. A revoked runner is found but not
 * admitted, so revoking takes effect on the next request rather than whenever
 * the runner happens to restart.
 */
@Injectable()
export class RunnerTokenAuth implements RunnerAuthPort {
  constructor(
    private readonly runners: DrizzleRunnerRepository,
    @Inject(TOKEN_MINT) private readonly tokens: TokenMintPort,
  ) {}

  async identify(token: string | undefined): Promise<RunnerId | null> {
    if (!token) {
      return null;
    }

    const found = await this.runners.findByTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );

    return found && !found.revoked ? found.id : null;
  }
}
