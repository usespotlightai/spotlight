import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import type { UsedPoolTokensRepository } from '@runners/domain/repositories/used-pool-tokens.repository';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { poolToken } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleUsedPoolTokensRepository
  implements UsedPoolTokensRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async wasUsed(token: TokenHash): Promise<boolean> {
    const [used] = await this.context.db
      .select({ tokenHash: poolToken.tokenHash })
      .from(poolToken)
      .where(eq(poolToken.tokenHash, token.value))
      .limit(1);

    return used !== undefined;
  }

  async recordUse(token: TokenHash, to: RunnerPoolId): Promise<void> {
    try {
      await this.context.db
        .insert(poolToken)
        .values({ tokenHash: token.value, poolId: to.value });
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'pool_token_pkey')) {
        throw new PoolTokenAlreadyUsedError();
      }

      throw error;
    }
  }
}
