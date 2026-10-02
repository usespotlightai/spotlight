import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
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

  async onSettled(event: ChangeStackSettled): Promise<void> {
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
      await this.stacks.save(stack.askedToReorder());
    }
  }

  async onReordered(stackId: ChangeStackId): Promise<void> {
    const [stack, check] = await Promise.all([
      this.stacks.find(stackId),
      this.checks.find(stackId),
    ]);

    if (stack && check?.reordering) {
      await this.checks.save(
        check.reordered(stack.entries(), this.clock.now()),
      );
    }
  }

  async onReorderingEnded(stackId: ChangeStackId): Promise<void> {
    const check = await this.checks.find(stackId);

    if (check?.reordering) {
      await this.checks.save(check.keptLayers());
    }
  }
}
