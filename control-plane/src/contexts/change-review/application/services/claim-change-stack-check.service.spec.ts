import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import { ClaimChangeStackCheck } from '@change-review/application/services/claim-change-stack-check.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-23T09:00:00.000Z');
const LAPTOP = RunnerTerms.of(['laptop']);
const RUNNER = RunnerId.of('pooled_1');

const settled = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack_1'),
    runId: RunId.of('run_1'),
    taskId: null,
    workspaceId: WorkspaceId.of('ws_1'),
    repository: null,
    base: null,
    diff: Diff.of([
      {
        path: 'schema.ts',
        previousPath: null,
        status: 'modified',
        binary: false,
        hunks: [
          {
            id: HunkId.at(1),
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            patch: '@@ -1 +1 @@\n-before\n+after',
          },
        ],
      },
    ]),
    facts: StackFacts.none(),
    request: CheckRequest.of('npm test', null),
    now: NOW,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Schema',
        intent: 'Schema',
        layers: [
          {
            title: 'Schema',
            summary: 'Schema',
            dependsOn: [],
            ranges: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'schema.ts', note: 'Why' }],
          },
        ],
      },
    ],
    NOW,
  );

const reservedFor = (runner: RunnerId) => {
  const stack = settled();

  return StackCheck.begin({
    stackId: stack.id,
    runId: stack.runId,
    workspaceId: stack.workspaceId,
    request: CheckRequest.of('npm test', null),
    entries: stack.entries(),
    now: NOW,
  }).reservedFor(runner, 'pool_burst', NOW);
};

const claimingReserved = (found: StackCheck | null) => {
  const saved: StackCheck[] = [];
  const reservedTo = vi.fn(async () => found);

  return {
    saved,
    reservedTo,
    service: new ClaimChangeStackCheck(
      {
        reservedTo,
        save: async (check: StackCheck) => {
          saved.push(check);
        },
      } as unknown as StackCheckRepository,
      { find: async () => settled() } as unknown as ChangeStackRepository,
      { patchOf: () => 'diff' } as PatchWriterPort,
      { run: (work) => work() } as TransactionPort,
    ),
  };
};

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

  describe('for a runner started for a reserved check', () => {
    it('claims the check reserved for it and lets the reservation go', async () => {
      const { service, saved, reservedTo } = claimingReserved(
        reservedFor(RUNNER),
      );

      const claimed = await service.claimReserved(RUNNER, NOW);

      expect(claimed).toMatchObject({
        stackId: 'stack_1',
        runId: 'run_1',
        command: 'npm test',
      });
      expect(reservedTo).toHaveBeenCalledWith(RUNNER, NOW);
      expect(saved[0]?.claim.claimedBy).toEqual(RUNNER);
      expect(saved[0]?.reservation).toBeNull();
    });

    it('claims no check reserved for another runner', async () => {
      const { service, saved } = claimingReserved(
        reservedFor(RunnerId.of('pooled_2')),
      );

      await expect(service.claimReserved(RUNNER, NOW)).resolves.toBeNull();
      expect(saved).toEqual([]);
    });

    it('claims nothing where no check is reserved for it', async () => {
      const { service, saved } = claimingReserved(null);

      await expect(service.claimReserved(RUNNER, NOW)).resolves.toBeNull();
      expect(saved).toEqual([]);
    });
  });
});
