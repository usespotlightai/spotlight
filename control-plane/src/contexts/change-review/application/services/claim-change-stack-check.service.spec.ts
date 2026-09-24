import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import { ClaimChangeStackCheck } from '@change-review/application/services/claim-change-stack-check.service';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-23T09:00:00.000Z');
const LAPTOP = RunnerTerms.of(['laptop']);

describe('ClaimChangeStackCheck', () => {
  it('hands a runner no check placed on runners it does not answer to', async () => {
    const dueForCheck = vi.fn(async () => ({
      request: CheckRequest.of(
        'npm test',
        'npm ci',
        RunnerPlacement.of(['vpc-internal']),
      ),
    }));
    const find = vi.fn();

    const claimed = await new ClaimChangeStackCheck(
      { dueForCheck } as unknown as StackCheckRepository,
      { find } as unknown as ChangeStackRepository,
      {} as PatchWriterPort,
      { run: (work) => work() } as TransactionPort,
    ).claimNext(WorkspaceId.of('ws_1'), RunnerId.of('runner_1'), LAPTOP, NOW);

    expect(claimed).toBeNull();
    expect(find).not.toHaveBeenCalled();
    expect(dueForCheck).toHaveBeenCalledWith(
      expect.objectContaining({ terms: LAPTOP }),
      NOW,
    );
  });
});
