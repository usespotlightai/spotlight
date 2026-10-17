import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { HookCallsPort } from '@integrations/application/ports/hook-calls.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type {
  HookMoment,
  HookRuntimePort,
  ListeningHook,
  StepAsked,
  StepOutcome,
  StepTaken,
} from '@integrations/application/ports/hook-runtime.port';
import type {
  HookedTask,
  TasksForHooksPort,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskNotesFromHooksPort } from '@work/application/ports/task-notes-from-hooks.port';

const WAIT_AGAIN_MS = 2_000;

const BEFORE_BUDGET_MS = 60_000;

const FORGOTTEN_AT_ONCE = 500;

export interface Happened {
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly change: string;
  readonly task: HookedTask;
  readonly event: Readonly<Record<string, unknown>>;
  readonly matchedLater?: boolean;
}

interface LeasedFiring {
  firing: HookFiring;
}

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failed = (name: string, reason: string): StepTaken => ({
  outcome: { name, status: 'failed', code: 'errored', reason, output: null },
  refusal: null,
  trace: null,
});

const reasonOf = (outcome: StepOutcome): string =>
  outcome.status === 'failed' ? outcome.reason : 'had no answer in time';

class StepFailed extends Error {
  readonly failure: HookFailure;

  constructor(hook: string, step: string, failure: HookFailure) {
    super(`Hook ${hook} failed at step ${step}. Reason: ${failure.reason}`);
    this.name = 'StepFailed';
    this.failure = HookFailure.of(failure.code, this.message);
  }
}

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

export class FireHooks {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly firings: HookFiringRepository,
    private readonly history: HookFiringHistoryPort,
    private readonly tasks: TasksForHooksPort,
    private readonly notes: TaskNotesFromHooksPort,
    private readonly calls: HookCallsPort,
    private readonly pullRequests: PullRequestPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly causation: CausationPort,
    private readonly logger: LoggerPort,
  ) {}

  async listens(teamId: string, on: HookEventName): Promise<boolean> {
    return (await this.runtime.listening(teamId, on)).length > 0;
  }

  async before(
    task: HookedTask,
    on: HookEventName,
    event: Readonly<Record<string, unknown>>,
    until: Date | null = null,
  ): Promise<HookVerdict> {
    const moment: HookMoment = {
      on,
      occurrence: this.ids.generate(),
      at: this.clock.now(),
      task,
      event,
      firing: null,
    };

    const budget = new Date(
      Math.min(
        until?.getTime() ?? Number.POSITIVE_INFINITY,
        moment.at.getTime() + BEFORE_BUDGET_MS,
      ),
    );

    for (const hook of await this.runtime.listening(task.teamId, on)) {
      if (hook.broken) {
        this.logger.warn(
          { hook: hook.key, reason: hook.broken },
          'A hook no longer reads as it was written',
        );

        const verdict = HookVerdict.onBrokenHook(
          hook.key,
          hook.broken,
          hook.blocks,
        );

        if (verdict.refuses) {
          return verdict;
        }

        continue;
      }

      if (!this.runtime.matches(hook, moment)) {
        continue;
      }

      const verdict = await this.ranBefore(hook, moment, budget);

      if (verdict.refuses) {
        return verdict;
      }
    }

    return HookVerdict.allowed();
  }

  async happened(happened: Happened): Promise<number> {
    const at = this.clock.now();
    const moment: HookMoment = {
      on: happened.on,
      occurrence: happened.occurrence,
      task: happened.task,
      event: happened.event,
      at,
      firing: null,
    };
    const matchedLater = happened.matchedLater === true;
    const change = {
      kind: 'event' as const,
      key: `${happened.on}:${happened.task.taskId}:${happened.change}`,
      saying: `${happened.on} of ${happened.task.title}${happened.change ? ` (${happened.change})` : ''}`,
    };
    const cause = this.causation.current().followedBy(change);
    let fired = 0;

    for (const hook of await this.runtime.listening(
      happened.task.teamId,
      happened.on,
    )) {
      if (hook.broken) {
        this.logger.warn(
          { hook: hook.key, reason: hook.broken },
          'A hook no longer reads as it was written',
        );
        continue;
      }

      if (!matchedLater && !this.runtime.matches(hook, moment)) {
        continue;
      }

      const queued = await this.firings.add(
        HookFiring.fire({
          id: this.ids.generate(),
          hookId: hook.id,
          workspaceId: happened.task.workspaceId,
          teamId: happened.task.teamId,
          taskId: happened.task.taskId,
          runId: happened.task.runId,
          stationKey: happened.task.stationKey,
          on: happened.on,
          occurrence: happened.occurrence,
          firedAt: at,
          event: happened.event,
          matched: !matchedLater,
          cause,
          link: {
            kind: 'hook',
            key: `hook:${hook.id}:${change.key}`,
            saying: `the hook ${hook.key}`,
          },
        }),
      );

      fired += queued ? 1 : 0;
    }

    return fired;
  }

  async workOne(): Promise<boolean> {
    const claimed = await this.firings.claimNext(this.clock.now());

    if (!claimed) {
      return false;
    }

    const leased: LeasedFiring = { firing: claimed };

    await unlessVersionConflict(async () => {
      try {
        await this.causation.within(
          claimed.cause.followedBy(claimed.link),
          () => this.delivered(leased),
        );
      } catch (error) {
        if (error instanceof HookFiringVersionConflictError) {
          throw error;
        }

        await this.settled(
          leased.firing,
          error instanceof StepFailed
            ? error.failure
            : HookFailure.of('errored', because(error)),
        );
      }
    });

    return true;
  }

  async processDue(limit = 50): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }

  async forgetFinished(): Promise<number> {
    const now = this.clock.now();
    const finished = await this.firings.finishedBefore(
      HookFiring.finishedForgettablyBefore(now),
      FORGOTTEN_AT_ONCE,
    );

    for (const firing of finished) {
      await unlessVersionConflict(() =>
        this.firings.save(firing.forgotten(now)),
      );
    }

    return finished.length;
  }

  private async settled(
    firing: HookFiring,
    failure: HookFailure,
  ): Promise<void> {
    const now = this.clock.now();
    const movedOn = firing.retries(failure, now)
      ? false
      : await this.notes.movedOn(firing.taskId, firing.stationKey);

    await this.firings.save(firing.failedWith(failure, now, movedOn));
  }

  private async stopped(
    leased: LeasedFiring,
    hook: string,
    loop: HookFailure,
  ): Promise<void> {
    if (!leased.firing.stoppedForLooping) {
      leased.firing = await this.kept(leased.firing.stopForLoop(loop));
    }

    const { firing } = leased;

    try {
      const heard = await this.notes.failed({
        taskId: firing.taskId,
        stationKey: firing.stationKey,
        hook,
        code: loop.code,
        saying: loop.reason,
        heardAs: `loop:${firing.id}`,
      });

      this.logger.warn(
        { hook, task: firing.taskId, loop: loop.reason, heard },
        'Stopped a hook that would loop',
      );

      await this.firings.save(
        firing.toldOfLoop(this.clock.now(), heard !== 'reported'),
      );
    } catch (error) {
      if (error instanceof HookFiringVersionConflictError) {
        throw error;
      }

      this.logger.warn(
        { err: error, hook, task: firing.taskId },
        'Could not yet tell of a hook stopped for looping',
      );
      await this.firings.save(
        firing.failedWith(
          HookFailure.of('errored', because(error)),
          this.clock.now(),
          false,
        ),
      );
    }
  }

  private async ranBefore(
    hook: ListeningHook,
    moment: HookMoment,
    until: Date,
  ): Promise<HookVerdict> {
    const own = this.clock.now().getTime() + hook.timeoutSeconds * 1000;
    const deadline = new Date(Math.min(own, until.getTime()));
    const earlier: StepOutcome[] = [];

    for (const step of hook.steps) {
      const taken = await this.taken({
        hook,
        step,
        moment,
        earlier,
        resuming: null,
        deadline,
        waiting: 'until-answered',
      });

      await this.traced(moment, taken);
      earlier.push(taken.outcome);

      const failedBecause =
        taken.outcome.status === 'done' ? null : reasonOf(taken.outcome);

      if (failedBecause !== null && taken.refusal === null) {
        this.logger.warn(
          { hook: hook.key, step, reason: failedBecause },
          'A hook before an event failed',
        );
      }

      const verdict =
        hook.written?.verdictOn(step, {
          refusal: taken.refusal,
          failedBecause,
        }) ?? null;

      if (verdict) {
        return verdict;
      }
    }

    return HookVerdict.allowed();
  }

  private async taken(asked: StepAsked): Promise<StepTaken> {
    try {
      return await this.runtime.step(asked);
    } catch (error) {
      return failed(asked.step, because(error));
    }
  }

  private async kept(firing: HookFiring): Promise<HookFiring> {
    await this.firings.save(firing);

    const reread = await this.firings.withId(firing.id);

    if (!reread) {
      throw new HookFiringVersionConflictError(firing.id);
    }

    return reread;
  }

  private async delivered(leased: LeasedFiring): Promise<void> {
    const { firing } = leased;
    const hook = await this.runtime.hook(firing.hookId);

    if (!hook) {
      await this.firings.save(firing.worked(this.clock.now()));
      return;
    }

    if (hook.broken) {
      await this.firings.save(
        firing.failedWith(
          HookFailure.of(
            'broken',
            `Hook ${hook.key} is broken. Reason: ${hook.broken}`,
          ),
          this.clock.now(),
          false,
        ),
      );
      return;
    }

    const task = await this.tasks.of(firing.taskId, firing.runId);

    if (!task) {
      await this.firings.save(
        firing.failedWith(
          HookFailure.of(
            'superseded',
            'The task of this hook firing no longer exists.',
          ),
          this.clock.now(),
          false,
        ),
      );
      return;
    }

    const moment = await this.momentOf(firing, task);

    if (!firing.matched) {
      if (!this.runtime.matches(hook, moment)) {
        await this.firings.save(firing.worked(this.clock.now()));
        return;
      }

      leased.firing = await this.kept(firing.recordMatch(moment.event));
    }

    const loop = leased.firing.loopStop(
      hook.key,
      await this.history.recentRepeats(leased.firing),
    );

    if (loop) {
      await this.stopped(leased, hook.key, loop);
      return;
    }

    const done = new Map(leased.firing.steps.map((step) => [step.name, step]));
    const earlier: StepOutcome[] = [];

    for (const step of hook.steps) {
      const before = done.get(step);

      if (before?.status === 'done') {
        earlier.push(before);
        continue;
      }

      const taken = await this.taken({
        hook,
        step,
        moment,
        earlier,
        resuming: before?.status === 'waiting' ? before : null,
        deadline: new Date(
          this.clock.now().getTime() + hook.timeoutSeconds * 1000,
        ),
        waiting: 'hand-back',
      });

      if (taken.outcome.status === 'waiting') {
        const waiting = await this.kept(
          leased.firing.recordStep([...earlier, taken.outcome]),
        );

        await this.firings.save(
          waiting.waitUntil(
            new Date(this.clock.now().getTime() + WAIT_AGAIN_MS),
          ),
        );
        return;
      }

      await this.traced(moment, taken);

      if (taken.outcome.status === 'failed') {
        leased.firing = await this.kept(
          leased.firing.recordStep([...earlier, taken.outcome]),
        );
        throw new StepFailed(
          hook.key,
          step,
          HookFailure.of(taken.outcome.code, taken.outcome.reason),
        );
      }

      earlier.push(taken.outcome);
      leased.firing = await this.kept(leased.firing.recordStep(earlier));
    }

    await this.firings.save(leased.firing.worked(this.clock.now()));
  }

  private async momentOf(
    firing: HookFiring,
    task: HookedTask,
  ): Promise<HookMoment> {
    const moment: HookMoment = {
      on: firing.on,
      occurrence: firing.occurrence,
      at: firing.firedAt,
      task,
      event: firing.event,
      firing: firing.id,
    };

    if (firing.matched || firing.on !== 'pull-request.merged') {
      return moment;
    }

    const url = String(firing.event.url ?? '');
    const repository = String(firing.event.repository ?? '');

    return {
      ...moment,
      event: {
        ...firing.event,
        changed: await this.pullRequests.changedIn(
          WorkspaceId.of(firing.workspaceId),
          Repository.of(repository),
          PullRequestUrl.of(url),
        ),
      },
    };
  }

  private async traced(moment: HookMoment, taken: StepTaken): Promise<void> {
    if (!taken.trace || !moment.task.runId) {
      return;
    }

    try {
      await this.calls.record(moment.task.runId, taken.trace);
    } catch (error) {
      this.logger.warn(
        { err: error, run: moment.task.runId },
        'Could not trace a hook call',
      );
    }
  }
}
