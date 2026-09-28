import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import type { GivenPoolTokensRepository } from '@runners/domain/repositories/given-pool-tokens.repository';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { poolToken } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleGivenPoolTokensRepository
  implements GivenPoolTokensRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async wasGiven(token: TokenHash): Promise<boolean> {
    const [given] = await this.context.db
      .select({ tokenHash: poolToken.tokenHash })
      .from(poolToken)
      .where(eq(poolToken.tokenHash, token.value))
      .limit(1);

    return given !== undefined;
  }

  async give(token: TokenHash, to: RunnerPoolId): Promise<void> {
    try {
      await this.context.db
        .insert(poolToken)
        .values({ tokenHash: token.value, poolId: to.value });
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'pool_token_pkey')) {
        throw new PoolTokenSpentError();
      }

      throw error;
    }
  }
}
