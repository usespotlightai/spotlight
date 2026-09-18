import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { ReleaseHeldRuns } from '@work/application/events/handlers/release-held-runs.handler';
import type { RunLeases } from '@work/application/services/run-leases.service';
import { describe, expect, it, vi } from 'vitest';

describe('ReleaseHeldRuns', () => {
  it('puts back whatever the revoked runner was holding', async () => {
    const releaseHeldBy = vi.fn(async () => {});

    await new ReleaseHeldRuns({
      releaseHeldBy,
    } as unknown as RunLeases).onRunnerRevoked(RunnerId.of('runner_1'));

    expect(releaseHeldBy).toHaveBeenCalledOnce();
    expect(releaseHeldBy.mock.calls[0]).toEqual([RunnerId.of('runner_1')]);
  });
});
