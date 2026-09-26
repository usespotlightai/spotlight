import { RunnerEgress } from '@runners/application/services/runner-egress.service';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import {
  aRunner,
  hashOf,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { describe, expect, it } from 'vitest';

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const egressOf = (held: Runner | null) =>
  new RunnerEgress(
    {
      findByEgressTokenHash: async (hash: TokenHash) =>
        held?.egressTokenHash?.equals(hash) ? held : null,
    } as unknown as RunnerRepository,
    {
      hash: (token: string) =>
        (token === 'egress-token' ? 'e' : 'f').repeat(64),
    } as TokenMintPort,
  );

describe('RunnerEgress', () => {
  it('admits the egress of a runner holding its work, for that work', async () => {
    const runner = aRunner().took(RunnerWork.run('run_1'), later(1));

    await expect(
      egressOf(runner).admit('egress-token', later(2)),
    ).resolves.toEqual({
      runnerId: runner.id.value,
      workspaceId: runner.workspaceId.value,
      work: { kind: 'run', id: 'run_1' },
    });
  });

  it('refuses no token, an unknown one, and a runner that holds nothing or has ended', async () => {
    const waiting = aRunner();
    const ended = waiting
      .took(RunnerWork.check('stack_1'), later(1))
      .ended(later(2));

    await expect(
      egressOf(waiting).admit(undefined, later(1)),
    ).resolves.toBeNull();
    await expect(
      egressOf(waiting).admit('other', later(1)),
    ).resolves.toBeNull();
    await expect(
      egressOf(waiting).admit('egress-token', later(1)),
    ).resolves.toBeNull();
    await expect(
      egressOf(ended).admit('egress-token', later(3)),
    ).resolves.toBeNull();
  });

  it('keeps the egress token apart from the runner’s own', () => {
    const runner = aRunner();

    expect(runner.egressTokenHash?.equals(runner.tokenHash)).toBe(false);
    expect(runner.egressTokenHash?.equals(hashOf('e'))).toBe(true);
  });
});
