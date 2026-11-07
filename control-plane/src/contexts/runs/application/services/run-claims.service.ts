import type { ExclusiveClaimLocksPort } from '@runs/application/ports/exclusive-claim-locks.port';
import type { RunTraceLinksPort } from '@runs/application/ports/run-trace-links.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import {
  type ClaimCursor,
  ClaimOrder,
  type QueuedRuns,
} from '@runs/domain/services/claim-order';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';

const CLAIM_WINDOW = 50;

export class RunClaims {
  constructor(
    private readonly runs: RunRepository,
    private readonly telemetry: TelemetryPort,
    private readonly traces: RunTraceLinksPort,
    private readonly locks: ExclusiveClaimLocksPort,
  ) {}

  async next(by: Claimant, now: Date): Promise<Run | null> {
    let after: ClaimCursor | null = null;

    for (;;) {
      const page = await this.runs.claimCandidates(by, now, {
        max: CLAIM_WINDOW,
        after,
      });
      const claimed = await this.firstClaimed(page, by, now);

      if (claimed || page.waiting.length < CLAIM_WINDOW) {
        return claimed;
      }

      after = ClaimOrder.cursorAfter(page.waiting);
    }
  }

  private async firstClaimed(
    page: QueuedRuns,
    by: Claimant,
    now: Date,
  ): Promise<Run | null> {
    for (const run of ClaimOrder.inOrder(page, by, now)) {
      const claimed = run.claim(by, now);

      if (await this.saved(claimed)) {
        await this.traces.linkActiveSpanTo(claimed.id);
        this.telemetry.measure(
          'spotlight.runs.claim_wait_seconds',
          Math.max(0, (now.getTime() - run.queuedAt.getTime()) / 1000),
          { 'spotlight.run.kind': claimed.requester.kind },
        );

        return claimed;
      }
    }

    return null;
  }

  private async saved(claimed: Run): Promise<boolean> {
    if (!claimed.policy.exclusive) {
      return this.versioned(claimed);
    }

    return this.locks.claimingFor(claimed.requester, async () =>
      (await this.runs.leasedAmong([claimed.requester])).length > 0
        ? false
        : this.versioned(claimed),
    );
  }

  private async versioned(claimed: Run): Promise<boolean> {
    try {
      await this.runs.save(claimed);
      return true;
    } catch (error) {
      if (error instanceof RunVersionConflictError) {
        return false;
      }
      throw error;
    }
  }
}
