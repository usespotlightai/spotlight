import type { CausationPort } from '@integrations/application/ports/causation.port';
import type {
  HookEventInstance,
  HookRuntimePort,
} from '@integrations/application/ports/hook-runtime.port';
import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { hookMatches } from '@integrations/application/services/hook-matching';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import { CauseLinks } from '@integrations/domain/services/cause-links';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import type { HookOccurrence } from '@integrations/domain/value-objects/hook-occurrence.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';

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

  async queue(task: TaskView, occurred: HookOccurrence): Promise<number> {
    const at = this.clock.now();
    const instance: HookEventInstance = {
      on: occurred.on,
      occurrence: occurred.key,
      task,
      event: occurred.payload,
      at,
      firing: null,
    };
    const matchedAfterChanges = occurred.matchedAfterChanges;
    const change = CauseLinks.change({
      on: occurred.on,
      taskId: task.taskId,
      change: occurred.change,
      taskTitle: task.title,
    });
    const cause = this.causation.current().append(change);
    let fired = 0;

    for (const hook of await this.runtime.listening(task.teamId, occurred.on)) {
      if (hook.broken) {
        this.logger.warn(
          { hook: hook.key.value, reason: hook.broken },
          'A hook no longer reads as it was written',
        );
        continue;
      }

      if (!matchedAfterChanges && !hookMatches(this.runtime, hook, instance)) {
        this.logger.debug(
          {
            workspaceId: task.workspaceId.value,
            teamId: task.teamId.value,
            taskId: task.taskId.value,
            runId: task.runId?.value,
            hook: hook.key.value,
            on: occurred.on,
          },
          'A hook did not match',
        );
        continue;
      }

      const queued = await this.firings.add(
        HookFiring.fire({
          id: HookFiringId.of(this.ids.generate()),
          hookId: hook.id,
          workspaceId: task.workspaceId,
          teamId: task.teamId,
          taskId: task.taskId,
          runId: task.runId,
          stationKey: task.stationKey,
          on: occurred.on,
          occurrence: occurred.key,
          firedAt: at,
          event: occurred.payload,
          matched: !matchedAfterChanges,
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
