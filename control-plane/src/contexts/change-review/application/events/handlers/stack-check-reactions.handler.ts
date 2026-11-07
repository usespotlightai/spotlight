import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class StackCheckReactions {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly clock: ClockPort,
  ) {}

  async onCompleted(event: ChangeStackCompleted): Promise<void> {
    const stack = await this.stacks.find(event.stackId);
    const begun = stack ? StackCheck.beginFor(stack, this.clock.now()) : null;

    if (!begun || (await this.checks.find(begun.id))) {
      return;
    }

    await this.checks.add(begun);
  }

  async onLayersFailed(stackId: ChangeStackId): Promise<void> {
    const stack = await this.stacks.find(stackId);

    if (stack) {
      await this.stacks.save(stack.requestRedraft());
    }
  }

  async onRedrafted(stackId: ChangeStackId): Promise<void> {
    const stack = await this.stacks.find(stackId);
    const check = await this.checks.find(StackCheckId.first(stackId));

    if (stack && check?.redrafting) {
      await this.checks.save(
        check.redrafted(stack.entries(), this.clock.now()),
      );
    }
  }

  async onRedraftingEnded(stackId: ChangeStackId): Promise<void> {
    const check = await this.checks.find(StackCheckId.first(stackId));

    if (check?.redrafting) {
      await this.checks.save(check.retainCheckedLayers(this.clock.now()));
    }
  }
}
