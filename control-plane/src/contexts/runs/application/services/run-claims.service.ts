import type { RunTraceLinksPort } from '@runs/application/ports/run-trace-links.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ClaimOrder } from '@runs/domain/services/claim-order';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';

const CLAIM_WINDOW = 50;

export class RunClaims {
  constructor(
    private readonly runs: RunRepository,
    private readonly telemetry: TelemetryPort,
    private readonly traces: RunTraceLinksPort,
  ) {}

  async next(by: Claimant, now: Date): Promise<Run | null> {
    const candidates = await this.runs.claimCandidates(by, now, CLAIM_WINDOW);

    for (const run of ClaimOrder.inOrder(candidates, by, now)) {
      const claimed = run.claim(by.runner, now);

      if (await this.saved(claimed)) {
        await this.traces.linkActiveSpanTo(claimed.id);
        this.telemetry.measure(
          'spotlight.runs.claim_wait_seconds',
          Math.max(0, (now.getTime() - (run.queuedAt ?? now).getTime()) / 1000),
          { 'spotlight.run.kind': claimed.requester.kind },
        );

        return claimed;
      }
    }

    return null;
  }

  private async saved(claimed: Run): Promise<boolean> {
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
