import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { EgressTokenSpentError } from '@runners/domain/exceptions/egress-token-spent.error';
import type { GivenEgressTokensRepository } from '@runners/domain/repositories/given-egress-tokens.repository';
import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { egressToken } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleGivenEgressTokensRepository
  implements GivenEgressTokensRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async wasGiven(token: TokenHash): Promise<boolean> {
    const [given] = await this.context.db
      .select({ tokenHash: egressToken.tokenHash })
      .from(egressToken)
      .where(eq(egressToken.tokenHash, token.value))
      .limit(1);

    return given !== undefined;
  }

  async give(token: TokenHash, to: EgressId): Promise<void> {
    try {
      await this.context.db
        .insert(egressToken)
        .values({ tokenHash: token.value, egressId: to.value });
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'egress_token_pkey')) {
        throw new EgressTokenSpentError();
      }

      throw error;
    }
  }
}
