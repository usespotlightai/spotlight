import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class StackCheckReactions {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly clock: ClockPort,
  ) {}

  async onCompleted(event: ChangeStackCompleted): Promise<void> {
    const stack = await this.stacks.find(event.stackId);

    if (!stack?.request || stack.state !== 'ready') {
      return;
    }

    await this.checks.add(
      StackCheck.begin({
        stackId: stack.id,
        runId: stack.runId,
        taskId: stack.taskId,
        replay: stack.replay,
        workspaceId: stack.workspaceId,
        request: stack.request,
        entries: stack.entries(),
        now: this.clock.now(),
      }),
    );
  }

  async onLayersFailed(stackId: ChangeStackId): Promise<void> {
    const stack = await this.stacks.find(stackId);

    if (stack) {
      await this.stacks.save(stack.requestRedraft());
    }
  }

  async onRedrafted(stackId: ChangeStackId): Promise<void> {
    const stack = await this.stacks.find(stackId);
    const check = await this.checks.find(stackId, false);

    if (stack && check?.redrafting) {
      await this.checks.save(
        check.redrafted(stack.entries(), this.clock.now()),
      );
    }
  }

  async onRedraftingEnded(stackId: ChangeStackId): Promise<void> {
    const check = await this.checks.find(stackId, false);

    if (check?.redrafting) {
      await this.checks.save(check.retainCheckedLayers());
    }
  }
}
