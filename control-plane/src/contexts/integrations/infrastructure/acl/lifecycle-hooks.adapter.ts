import type { FireHooks } from '@integrations/application/services/fire-hooks.service';
import type { HookDecision as FiredDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { TaskViewMapper } from '@integrations/infrastructure/acl/task-view.mapper';
import type {
  BeforeHookEvent,
  HookDecision,
  LifecycleHooksPort,
  ToolUsedHookEvent,
} from '@work/application/ports/lifecycle-hooks.port';
import type { TaskViewDto } from '@work/application/ports/task-views.port';

const eventOf = ({ on: _, ...event }: BeforeHookEvent | ToolUsedHookEvent) =>
  event;

const decisionOf = (decision: FiredDecision): HookDecision =>
  decision.denyReason === null
    ? { kind: 'allowed' }
    : { kind: 'denied', reason: decision.denyReason };

export class LifecycleHooks implements LifecycleHooksPort {
  constructor(private readonly firings: FireHooks) {}

  listens(teamId: string, on: BeforeHookEvent['on']): Promise<boolean> {
    return this.firings.listens(teamId, on);
  }

  async before(
    task: TaskViewDto,
    instance: BeforeHookEvent,
    until?: Date,
  ): Promise<HookDecision> {
    return decisionOf(
      await this.firings.before(
        TaskViewMapper.toView(task),
        instance.on,
        eventOf(instance),
        until ?? null,
      ),
    );
  }

  async after(
    task: TaskViewDto,
    instance: ToolUsedHookEvent,
    occurrence: string,
  ): Promise<void> {
    await this.firings.happened({
      on: instance.on,
      occurrence,
      change: `${instance.tool} ${occurrence}`,
      task: TaskViewMapper.toView(task),
      event: eventOf(instance),
    });
  }
}
