import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  CheckWorkPort,
  ClaimedCheck,
} from '@work/application/ports/check-work.port';

export class ClaimChangeStackCheck implements CheckWorkPort {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly patches: PatchWriterPort,
    private readonly transaction: TransactionPort,
  ) {}

  claimNext(
    workspaceId: WorkspaceId,
    runner: RunnerId,
    now: Date,
  ): Promise<ClaimedCheck | null> {
    return this.transaction.run(async () => {
      const due = await this.checks.dueForCheck({ workspaceId, runner }, now);

      if (!due) {
        return null;
      }

      const stack = await this.stacks.find(due.stackId);

      if (!stack) {
        return null;
      }

      const claimed = due.claimedFor(runner, now);
      await this.checks.save(claimed);

      return {
        stackId: stack.id.value,
        runId: stack.runId.value,
        repository: stack.repository?.value ?? null,
        base: stack.base?.value ?? null,
        setup: claimed.request.setup,
        command: claimed.request.command,
        steps: stack.checkSteps(claimed.entries).map((step) => ({
          id: step.id,
          patch: this.patches.patchOf(stack.diff, new Set(step.hunks)),
          stopsOnFailure: step.isWholeChange,
          runsSetup: step.installsAnew,
        })),
      };
    });
  }
}
