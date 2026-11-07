import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { UsedTokensPort } from '@runners/application/ports/used-tokens.port';
import type {
  TokenHolder,
  TokenHolderKind,
} from '@runners/domain/value-objects/token-holder.vo';
import { usedToken } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleUsedTokens implements UsedTokensPort {
  constructor(private readonly context: DrizzleContext) {}

  async wasUsed(kind: TokenHolderKind, token: TokenHash): Promise<boolean> {
    const [used] = await this.context.db
      .select({ tokenHash: usedToken.tokenHash })
      .from(usedToken)
      .where(
        and(
          eq(usedToken.holderKind, kind),
          eq(usedToken.tokenHash, token.value),
        ),
      )
      .limit(1);

    return used !== undefined;
  }

  async record(token: TokenHash, holder: TokenHolder): Promise<boolean> {
    const recorded = await this.context.db
      .insert(usedToken)
      .values({
        holderKind: holder.kind,
        tokenHash: token.value,
        holderId: holder.id,
      })
      .onConflictDoNothing()
      .returning({ tokenHash: usedToken.tokenHash });

    return recorded.length > 0;
  }
}
