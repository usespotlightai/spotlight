import type { RunnerIdentityPort } from '@runners/application/ports/runner-identity.port';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class RunnerTokens implements RunnerIdentityPort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly tokens: TokenIssuer,
    private readonly clock: ClockPort,
  ) {}

  async authenticate(token: string | undefined): Promise<RunnerId | null> {
    if (!token) {
      return null;
    }

    const found = await this.runners.findByTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );

    return found?.isAlive(this.clock.now()) ? found.id : null;
  }
}
