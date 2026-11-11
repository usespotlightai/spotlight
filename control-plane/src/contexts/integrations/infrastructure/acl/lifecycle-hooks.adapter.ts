import type { HooksListening } from '@integrations/application/services/hooks-listening.service';
import type { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import type { RunBeforeHooks } from '@integrations/application/services/run-before-hooks.service';
import type { HookDecision as FiredDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { HookEventFacts } from '@integrations/domain/value-objects/hook-event-facts.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { TaskViewMapper } from '@integrations/infrastructure/acl/task-view.mapper';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type {
  BeforeHookEvent,
  HookDecision,
  LifecycleHooksPort,
  ToolUsedHookEvent,
} from '@work/application/ports/lifecycle-hooks.port';
import type { TaskViewDto } from '@work/application/ports/task-views.port';

const beforeFactsOf = (event: BeforeHookEvent): HookEventFacts => {
  switch (event.on) {
    case 'tool.using':
      return HookEventFacts.of({
        on: event.on,
        tool: Tool.of(event.tool),
        inputs: event.inputs,
      });
    case 'run.starting':
      return HookEventFacts.of({ on: event.on });
    case 'handover.submitting':
      return HookEventFacts.of({
        on: event.on,
        to: event.to,
        note: event.note,
      });
    case 'pull-request.opening':
      return HookEventFacts.of({
        on: event.on,
        repository: Repository.of(event.repository),
        branch: event.branch,
        title: event.title,
        changed: event.changed,
      });
  }
};

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
        beforeFactsOf(instance),
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
      {
        on: instance.on,
        tool: Tool.of(instance.tool),
        inputs: instance.inputs,
        output: instance.output,
        failed: instance.failed,
      },
      HookOccurrenceKey.of(occurrence),
    );
  }
}
