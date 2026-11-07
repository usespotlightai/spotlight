import type {
  LeasedWork,
  RunnersPort,
} from '@runners/application/ports/runners.port';
import type {
  CheckWorkPort,
  ClaimedCheck,
} from '@runs/application/ports/check-work.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

export class ClaimsTaken {
  constructor(
    private readonly runs: RunRepository,
    private readonly checks: CheckWorkPort,
    private readonly runners: RunnersPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async run(claimed: Run, runner: RunnerId): Promise<void> {
    await this.taken(runner, { kind: 'run', id: claimed.id.value }, () =>
      this.runUnclaimed(claimed, runner),
    );
    this.logger.info(
      {
        ...claimed.tags.value,
        workspaceId: claimed.workspaceId.value,
        runId: claimed.id.value,
        runnerId: runner.value,
        attempt: claimed.attempt,
      },
      'Claimed a run',
    );
  }

  async dropRun(claimed: Run, runner: RunnerId): Promise<void> {
    await this.runUnclaimed(claimed, runner);
  }

  async check(claimed: ClaimedCheck, runner: RunnerId): Promise<void> {
    await this.taken(runner, { kind: 'check', id: claimed.checkId.value }, () =>
      this.checks.unclaim(
        claimed.checkId,
        claimed.repeat,
        runner,
        this.clock.now(),
      ),
    );
    this.logger.info(
      { checkId: claimed.checkId.value, runnerId: runner.value },
      'Claimed a check',
    );
  }

  private async taken(
    runner: RunnerId,
    work: LeasedWork,
    unclaimed: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.runners.claim(runner, work, this.clock.now());
    } catch (notTaken) {
      try {
        await unclaimed();
      } catch (error) {
        this.logger.warn(
          {
            runnerId: runner.value,
            work: work.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Work that its runner could not claim stayed claimed, so it waits until its lease expires',
        );
      }

      throw notTaken;
    }
  }

  private async runUnclaimed(claimed: Run, runner: RunnerId): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const existing = await this.runs.findById(claimed.id);

      if (!existing?.isLeasedBy(runner)) {
        return;
      }

      try {
        await this.runs.save(existing.unclaimedBy(runner, this.clock.now()));
        return;
      } catch (error) {
        if (
          !(error instanceof RunVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
