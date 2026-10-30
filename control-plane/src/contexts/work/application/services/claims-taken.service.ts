import type {
  LeasedWork,
  RunnersPort,
} from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  CheckWorkPort,
  ClaimedCheck,
} from '@work/application/ports/check-work.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

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
        workspaceId: claimed.workspaceId.value,
        taskId: claimed.taskId?.value,
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
    await this.taken(runner, { kind: 'check', id: claimed.stackId }, () =>
      this.checks.unclaim(
        claimed.stackId,
        claimed.recheck,
        runner,
        this.clock.now(),
      ),
    );
    this.logger.info(
      { stackId: claimed.stackId, runnerId: runner.value },
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
        await this.runs.save(existing.unclaimedBy(runner));
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
