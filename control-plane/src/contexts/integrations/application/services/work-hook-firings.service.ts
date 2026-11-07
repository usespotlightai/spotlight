import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { CausationPort } from '@integrations/application/ports/causation.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
} from '@integrations/application/ports/hook-runtime.port';
import type { LoopNoticesPort } from '@integrations/application/ports/loop-notices.port';
import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { hookMatches } from '@integrations/application/services/hook-matching';
import type { HookSteps } from '@integrations/application/services/hook-steps.service';
import type {
  HookFiring,
  HookFiringSkip,
} from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import type { Hook } from '@integrations/domain/value-objects/hook.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

interface LeasedFiring {
  firing: HookFiring;
}

const CLAIM_WINDOW = 20;

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const unlessVersionConflict = async (
  work: () => Promise<void>,
): Promise<void> => {
  try {
    await work();
  } catch (error) {
    if (!(error instanceof HookFiringVersionConflictError)) {
      throw error;
    }
  }
};

export class WorkHookFirings {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly steps: HookSteps,
    private readonly firings: HookFiringRepository,
    private readonly history: HookFiringHistoryPort,
    private readonly tasks: TasksForHooksPort,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly loopNotices: LoopNoticesPort,
    private readonly pullRequests: PullRequestPort,
    private readonly clock: ClockPort,
    private readonly causation: CausationPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async workOne(): Promise<boolean> {
    const claimed = await this.claimNext();

    if (!claimed) {
      return false;
    }

    const leased: LeasedFiring = { firing: claimed };

    await unlessVersionConflict(async () => {
      const failure = await this.causation
        .runWith(claimed.cause.append(claimed.link), () =>
          this.delivered(leased),
        )
        .catch((error: unknown) => {
          if (error instanceof HookFiringVersionConflictError) {
            throw error;
          }

          this.logger.error(
            { err: error, firingId: leased.firing.id.value },
            'A hook firing failed in Spotlight',
          );

          return HookFailure.errored(because(error));
        });

      if (failure) {
        await this.recordFailure(leased.firing, failure);
      }
    });

    return true;
  }

  private async claimNext(): Promise<HookFiring | null> {
    const now = this.clock.now();
    const candidates = await this.firings.claimCandidates(now, CLAIM_WINDOW);

    for (const candidate of candidates) {
      if (!candidate.isClaimableAt(now)) {
        continue;
      }

      try {
        await this.firings.save(candidate.claimed(now));
      } catch (error) {
        if (error instanceof HookFiringVersionConflictError) {
          continue;
        }
        throw error;
      }

      return this.firings.withId(candidate.id);
    }

    return null;
  }

  async processDue(limit = 50): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }

  private async recordFailure(
    firing: HookFiring,
    failure: HookFailure,
  ): Promise<void> {
    const now = this.clock.now();
    const movedOn = firing.willRetry(failure, now)
      ? false
      : await this.notes.movedOn(firing.taskId.value, firing.stationKey.value);

    await this.firings.save(firing.failedWith(failure, now, movedOn));
  }

  private async stopped(
    leased: LeasedFiring,
    hook: string,
    loop: HookFailure,
  ): Promise<void> {
    if (!leased.firing.stoppedForLooping) {
      leased.firing = await this.saved(leased.firing.stopForLoop(loop));
      this.counted('loop_stopped');
    }

    const { firing } = leased;
    const notice = await this.loopNotices.send({
      taskId: firing.taskId,
      stationKey: firing.stationKey,
      hook,
      loop,
      receivedAs: `loop:${firing.id.value}`,
    });

    if (notice.kind === 'failed') {
      this.logger.warn(
        { hook, task: firing.taskId.value, reason: notice.failure.reason },
        'Could not send the notice of a hook stopped for looping',
      );
      await this.firings.save(
        firing.failedWith(notice.failure, this.clock.now(), false),
      );
      return;
    }

    this.logger.warn(
      {
        hook,
        task: firing.taskId.value,
        loop: loop.reason,
        notice: notice.onTask,
      },
      'Stopped a hook that would loop',
    );

    await this.firings.save(
      firing.markLoopNotified(this.clock.now(), notice.onTask !== 'reported'),
    );
  }

  private async saved(firing: HookFiring): Promise<HookFiring> {
    await this.firings.save(firing);

    const reloaded = await this.firings.withId(firing.id);

    if (!reloaded) {
      throw new HookFiringVersionConflictError(firing.id.value);
    }

    return reloaded;
  }

  private counted(outcome: 'skipped' | 'loop_stopped'): void {
    this.telemetry.count('spotlight.hook_firings', {
      'spotlight.hook_firing.outcome': outcome,
    });
  }

  private skipped(firing: HookFiring, reason: HookFiringSkip): void {
    this.counted('skipped');
    this.logger.info(
      {
        workspaceId: firing.workspaceId.value,
        taskId: firing.taskId.value,
        runId: firing.runId?.value,
        firingId: firing.id.value,
        hookId: firing.hookId.value,
        reason,
      },
      'Skipped a hook firing',
    );
  }

  private async delivered(leased: LeasedFiring): Promise<HookFailure | null> {
    const { firing } = leased;
    const hook = await this.runtime.hook(firing.hookId);

    if (!hook) {
      await this.firings.save(firing.skipped('hook-deleted', this.clock.now()));
      this.skipped(firing, 'hook-deleted');
      return null;
    }

    if (hook.broken || !hook.written) {
      await this.firings.save(
        firing.hookBroken(hook.key.value, hook.broken ?? '', this.clock.now()),
      );
      return null;
    }

    const task = await this.tasks.of(firing.taskId, firing.runId);

    if (!task) {
      await this.firings.save(firing.taskGone(this.clock.now()));
      return null;
    }

    const instance = await this.eventInstanceOf(firing, task);

    if (!firing.matched) {
      if (!hookMatches(this.runtime, hook, instance)) {
        await this.firings.save(
          firing.skipped('no-longer-matches', this.clock.now()),
        );
        this.skipped(firing, 'no-longer-matches');
        return null;
      }

      leased.firing = await this.saved(firing.recordMatch(instance.event));
    }

    const loop = leased.firing.loopStop(
      hook.key.value,
      await this.history.recentRepeats(leased.firing.repeatsOf),
    );

    if (loop) {
      await this.stopped(leased, hook.key.value, loop);
      return null;
    }

    return this.stepped(leased, hook, hook.written, instance);
  }

  private async stepped(
    leased: LeasedFiring,
    hook: ListeningHook,
    written: Hook,
    instance: HookEventInstance,
  ): Promise<HookFailure | null> {
    for (
      let next = leased.firing.nextStepOf(written);
      next !== null;
      next = leased.firing.nextStepOf(written)
    ) {
      const stepResult = await this.steps.take({
        hook,
        step: next.name,
        instance,
        earlier: next.earlier,
        resuming: next.resuming,
        deadline: written.deadlineFrom(this.clock.now(), null),
        waitMode: 'suspend',
      });
      const { outcome } = stepResult;

      if (outcome.status === 'waiting') {
        await this.firings.save(
          leased.firing.stepTaken(written, outcome, this.clock.now()),
        );
        return null;
      }

      await this.steps.traced(instance, stepResult);
      leased.firing = await this.saved(
        leased.firing.stepTaken(written, outcome, this.clock.now()),
      );

      if (outcome.status === 'failed') {
        return HookFailure.of(outcome.code, outcome.reason).atStep(
          hook.key,
          next.name,
        );
      }
    }

    await this.firings.save(leased.firing.worked(this.clock.now()));
    return null;
  }

  private async eventInstanceOf(
    firing: HookFiring,
    task: TaskView,
  ): Promise<HookEventInstance> {
    const changes = firing.changesToRead;

    return {
      on: firing.on,
      occurrence: firing.occurrence,
      at: firing.firedAt,
      task,
      run: firing.run,
      event: changes
        ? firing.eventWithChanges(
            await this.pullRequests.changedIn(
              firing.workspaceId,
              changes.repository,
              changes.pullRequest,
            ),
          )
        : firing.event,
      firing: firing.id,
    };
  }
}
