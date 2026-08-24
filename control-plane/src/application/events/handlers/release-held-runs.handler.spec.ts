import { ReleaseHeldRuns } from '@application/events/handlers/release-held-runs.handler';
import { RunnerRevoked } from '@domain/events/runner-revoked.event';
import type { RunRepository } from '@domain/repositories/run.repository';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { describe, expect, it, vi } from 'vitest';

const runs = () =>
  ({
    releaseClaimedBy: vi.fn().mockResolvedValue(1),
  }) as unknown as RunRepository & {
    releaseClaimedBy: ReturnType<typeof vi.fn>;
  };

describe('ReleaseHeldRuns', () => {
  it('puts back whatever the revoked runner was holding', async () => {
    const repository = runs();

    await new ReleaseHeldRuns(repository).onRunnerRevoked(
      new RunnerRevoked(RunnerId.of('runner_1')),
    );

    expect(repository.releaseClaimedBy).toHaveBeenCalledOnce();
    expect(repository.releaseClaimedBy.mock.calls[0][0].value).toBe('runner_1');
  });
});
