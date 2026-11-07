import type { HooksListening } from '@integrations/application/services/hooks-listening.service';
import type { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import type { RunBeforeHooks } from '@integrations/application/services/run-before-hooks.service';
import type { HookDecision as FiredDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { TaskViewMapper } from '@integrations/infrastructure/acl/task-view.mapper';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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
  constructor(
    private readonly listening: HooksListening,
    private readonly beforeHooks: RunBeforeHooks,
    private readonly triggers: LifecycleHookTriggers,
  ) {}

  listens(teamId: string, on: BeforeHookEvent['on']): Promise<boolean> {
    return this.listening.on(TeamId.of(teamId), on);
  }

  async before(
    task: TaskViewDto,
    instance: BeforeHookEvent,
    until?: Date,
  ): Promise<HookDecision> {
    return decisionOf(
      await this.beforeHooks.decide(
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
    await this.triggers.toolUsed(
      TaskViewMapper.toView(task),
      { tool: instance.tool, event: eventOf(instance) },
      occurrence,
    );
  }
}
