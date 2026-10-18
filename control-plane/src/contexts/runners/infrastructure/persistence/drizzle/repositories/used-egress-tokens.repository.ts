import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import type { UsedEgressTokensRepository } from '@runners/domain/repositories/used-egress-tokens.repository';
import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { egressToken } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleUsedEgressTokensRepository
  implements UsedEgressTokensRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async wasUsed(token: TokenHash): Promise<boolean> {
    const [used] = await this.context.db
      .select({ tokenHash: egressToken.tokenHash })
      .from(egressToken)
      .where(eq(egressToken.tokenHash, token.value))
      .limit(1);

    return used !== undefined;
  }

  async recordUse(token: TokenHash, to: EgressId): Promise<void> {
    try {
      await this.context.db
        .insert(egressToken)
        .values({ tokenHash: token.value, egressId: to.value });
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'egress_token_pkey')) {
        throw new EgressTokenAlreadyUsedError();
      }

      throw error;
    }
  }
}
