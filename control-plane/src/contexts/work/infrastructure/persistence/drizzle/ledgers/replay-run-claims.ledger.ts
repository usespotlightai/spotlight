import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ReplayRunClaimsPort } from '@work/application/ports/replay-run-claims.port';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';
import { replayRunClaim } from '@work/infrastructure/persistence/drizzle/schemas/replay-run-claim.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleReplayRunClaims implements ReplayRunClaimsPort {
  constructor(private readonly context: DrizzleContext) {}

  async claim(first: ReplayRunClaim): Promise<ReplayRunClaim> {
    if (!this.context.transacting) {
      throw new InconsistentStateError(
        'replay run claim',
        'is taken only inside the transaction that acts on it',
      );
    }

    await this.context.db
      .insert(replayRunClaim)
      .values({ runId: first.runId.value, claimedAs: first.claimedAs })
      .onConflictDoNothing({ target: replayRunClaim.runId });

    const [held] = await this.context.db
      .select()
      .from(replayRunClaim)
      .where(eq(replayRunClaim.runId, first.runId.value))
      .for('update');

    return held
      ? ReplayRunClaim.rehydrate({
          runId: RunId.of(held.runId),
          claimedAs: held.claimedAs,
          refusal: held.refusal,
          reason: held.reason,
        })
      : first;
  }

  async save(claim: ReplayRunClaim): Promise<void> {
    await this.context.db
      .update(replayRunClaim)
      .set({
        claimedAs: claim.claimedAs,
        refusal: claim.refusal,
        reason: claim.reason,
      })
      .where(eq(replayRunClaim.runId, claim.runId.value));
  }
}
