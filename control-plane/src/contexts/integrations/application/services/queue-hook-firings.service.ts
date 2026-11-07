import type {
  HookEventInstance,
  HookRuntimePort,
} from '@integrations/application/ports/hook-runtime.port';
import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { hookMatches } from '@integrations/application/services/hook-matching';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import { CauseLinks } from '@integrations/domain/services/cause-links';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';

export interface HookEventOccurred {
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly change: string;
  readonly task: TaskView;
  readonly event: Readonly<Record<string, unknown>>;
  readonly matchedLater?: boolean;
}

export class QueueHookFirings {
  constructor(
    private readonly runtime: HookRuntimePort,
    private readonly firings: HookFiringRepository,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly causation: CausationPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async queue(happened: HookEventOccurred): Promise<number> {
    const at = this.clock.now();
    const instance: HookEventInstance = {
      on: happened.on,
      occurrence: happened.occurrence,
      task: happened.task,
      event: happened.event,
      at,
      firing: null,
    };
    const matchedLater = happened.matchedLater === true;
    const change = CauseLinks.change({
      on: happened.on,
      taskId: happened.task.taskId,
      change: happened.change,
      taskTitle: happened.task.title,
    });
    const cause = this.causation.current().append(change);
    let fired = 0;

    for (const hook of await this.runtime.listening(
      happened.task.teamId,
      happened.on,
    )) {
      if (hook.broken) {
        this.logger.warn(
          { hook: hook.key.value, reason: hook.broken },
          'A hook no longer reads as it was written',
        );
        continue;
      }

      if (!matchedLater && !hookMatches(this.runtime, hook, instance)) {
        this.logger.debug(
          {
            workspaceId: happened.task.workspaceId.value,
            teamId: happened.task.teamId.value,
            taskId: happened.task.taskId.value,
            runId: happened.task.runId?.value,
            hook: hook.key.value,
            on: happened.on,
          },
          'A hook did not match',
        );
        continue;
      }

      const queued = await this.firings.add(
        HookFiring.fire({
          id: HookFiringId.of(this.ids.generate()),
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
          link: CauseLinks.hookFiring(hook, change),
        }),
      );

      if (queued) {
        fired += 1;
        this.telemetry.count('spotlight.hook_firings', {
          'spotlight.hook_firing.outcome': 'fired',
        });
      }
    }

    return fired;
  }
}
