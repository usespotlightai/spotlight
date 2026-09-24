import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { ClaimOrder } from '@work/domain/services/claim-order';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const DEV = HarnessId.of('dev');
const BY = {
  runner: RunnerId.of('runner_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harnesses: [DEV],
  terms: RunnerTerms.of(['runner-1', 'laptop']),
};

const waiting = (
  id: string,
  over: {
    priority?: number;
    queuedAt?: string;
    harness?: string;
    targetRunner?: string;
    workspace?: string;
    placement?: string[];
  } = {},
) => ({
  run: Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of(over.workspace ?? 'ws_1'),
    harness: HarnessId.of(over.harness ?? 'dev'),
    priority: RunPriority.of(over.priority ?? 0),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station', keep: true },
    }),
    targetRunner: over.targetRunner ? RunnerId.of(over.targetRunner) : null,
    placement: RunnerPlacement.of(over.placement ?? []),
  }),
  queuedAt: new Date(over.queuedAt ?? '2026-09-17T09:00:00.000Z'),
});

const next = (...runs: ReturnType<typeof waiting>[]) =>
  ClaimOrder.next(runs, BY)?.id.value ?? null;

describe('ClaimOrder', () => {
  it('hands out the station nearest the end of the line first', () => {
    expect(
      next(
        waiting('near_front', { priority: 1 }),
        waiting('further', { priority: 3 }),
      ),
    ).toBe('further');
  });

  it('among equals, hands out the one that has waited longest', () => {
    expect(
      next(
        waiting('newer', { queuedAt: '2026-09-17T10:00:00.000Z' }),
        waiting('older', { queuedAt: '2026-09-17T08:00:00.000Z' }),
      ),
    ).toBe('older');
  });

  it('never hands a runner a harness it does not have', () => {
    expect(next(waiting('elsewhere', { harness: 'cursor' }))).toBeNull();
  });

  it('never hands a runner a run of another workspace', () => {
    expect(
      next(
        waiting('theirs', { workspace: 'ws_2', priority: 9 }),
        waiting('ours'),
      ),
    ).toBe('ours');
  });

  it('never hands a runner a run pinned to another', () => {
    expect(
      next(
        waiting('pinned', { targetRunner: 'runner_2', priority: 9 }),
        waiting('open'),
      ),
    ).toBe('open');
  });

  it('hands a runner the run pinned to it', () => {
    expect(next(waiting('mine', { targetRunner: 'runner_1' }))).toBe('mine');
  });

  it('never hands a runner a run placed on runners it does not answer to', () => {
    expect(
      next(
        waiting('placed', { placement: ['vpc-internal'], priority: 9 }),
        waiting('open'),
      ),
    ).toBe('open');
  });

  it('hands a runner a run placed on a label it carries', () => {
    expect(
      next(waiting('placed', { placement: ['vpc-internal', 'laptop'] })),
    ).toBe('placed');
  });

  it('hands out nothing already claimed', () => {
    const held = waiting('held');

    expect(
      ClaimOrder.next(
        [{ ...held, run: held.run.claim(RunnerId.of('runner_2'), new Date()) }],
        BY,
      ),
    ).toBeNull();
  });
});
