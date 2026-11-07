import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ReplayRunClaim } from '@replays/domain/aggregates/replay-run-claim.aggregate';
import { ReplayRunClaimVersionConflictError } from '@replays/domain/exceptions/replay-run-claim-version-conflict.error';
import type { ReplayRunClaimRepository } from '@replays/domain/repositories/replay-run-claim.repository';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { replayRunClaim } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, eq } from 'drizzle-orm';

type ClaimRow = typeof replayRunClaim.$inferSelect;

const toClaim = (row: ClaimRow): ReplayRunClaim =>
  ReplayRunClaim.rehydrate({
    runId: RunId.of(row.runId),
    claimedAs: row.claimedAs,
    unreplayableReason: row.unreplayableReason,
    reason: row.reason,
    trial: row.movesOnAfter
      ? {
          fingerprint: row.trialFingerprint
            ? StationFingerprint.of(row.trialFingerprint)
            : null,
          movesOnAfter: row.movesOnAfter,
        }
      : null,
    version: row.version,
  });

const columnsOf = (claim: ReplayRunClaim) => ({
  claimedAs: claim.claimedAs,
  unreplayableReason: claim.unreplayableReason,
  reason: claim.reason,
  trialFingerprint: claim.trial?.fingerprint?.value ?? null,
  movesOnAfter: claim.trial ? [...claim.trial.movesOnAfter] : null,
});

@Injectable()
export class DrizzleReplayRunClaimRepository
  implements ReplayRunClaimRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async find(runId: RunId): Promise<ReplayRunClaim | null> {
    const [found] = await this.context.db
      .select()
      .from(replayRunClaim)
      .where(eq(replayRunClaim.runId, runId.value));

    return found ? toClaim(found) : null;
  }

  async add(claim: ReplayRunClaim): Promise<void> {
    const written = await this.context.db
      .insert(replayRunClaim)
      .values({
        runId: claim.runId.value,
        ...columnsOf(claim),
        version: claim.version,
      })
      .onConflictDoNothing({ target: replayRunClaim.runId })
      .returning({ runId: replayRunClaim.runId });

    if (written.length === 0) {
      throw new ReplayRunClaimVersionConflictError(claim.runId);
    }
  }

  async save(claim: ReplayRunClaim): Promise<void> {
    const written = await this.context.db
      .update(replayRunClaim)
      .set({ ...columnsOf(claim), version: claim.version + 1 })
      .where(
        and(
          eq(replayRunClaim.runId, claim.runId.value),
          eq(replayRunClaim.version, claim.version),
        ),
      )
      .returning({ runId: replayRunClaim.runId });

    if (written.length === 0) {
      throw new ReplayRunClaimVersionConflictError(claim.runId);
    }
  }
}
