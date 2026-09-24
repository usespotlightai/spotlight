import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { describe, expect, it, vi } from 'vitest';

describe('workSubscribers', () => {
  it('tells Secrets to end what a run was granted once the run ends', async () => {
    const endedFor = vi.fn(async () => undefined);
    const ending = workSubscribers({
      runGrants: { endedFor },
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.end-secret-grants-of-ended-run',
    );

    await ending?.handle(
      new RunWithdrawn(RunId.of('run_1'), WorkspaceId.of('ws_1'), null),
    );

    expect(ending?.kinds).toEqual([
      'run.completed',
      'run.abandoned',
      'run.withdrawn',
    ]);
    expect(endedFor).toHaveBeenCalledWith('run_1');
  });
});
