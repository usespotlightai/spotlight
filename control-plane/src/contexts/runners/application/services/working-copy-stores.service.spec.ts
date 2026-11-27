import { WorkingCopyStores } from '@runners/application/services/working-copy-stores.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { WorkingCopyStore } from '@runners/domain/value-objects/working-copy-store.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { describe, expect, it } from 'vitest';

const STORE = WorkingCopyStore.of({ store: 's3://team-a', base: 'base-v1' });

const stores = (input: {
  runner?: CredentialSource;
  sandbox?: CredentialSource | null;
  pool?: Partial<RunnerPool>;
  trust?: Partial<RunnerTrust>;
}) =>
  new WorkingCopyStores(
    partial<RunnerRepository>({
      find: () =>
        Promise.resolve(
          input.runner ? partial<Runner>({ source: input.runner }) : null,
        ),
    }),
    partial<SandboxRepository>({
      find: () =>
        Promise.resolve(
          input.sandbox === undefined
            ? null
            : partial<Sandbox>({ source: input.sandbox }),
        ),
    }),
    partial<RunnerPoolRepository>({
      find: () =>
        Promise.resolve(
          input.pool
            ? partial<RunnerPool>({ isDeleted: false, ...input.pool })
            : null,
        ),
    }),
    partial<RunnerTrustRepository>({
      find: () =>
        Promise.resolve(
          input.trust
            ? partial<RunnerTrust>({ isDeleted: false, ...input.trust })
            : null,
        ),
    }),
  );

const pool = CredentialSource.ofId(PoolId.of('pool_1'));
const trust = CredentialSource.ofId(RunnerTrustId.of('trust_1'));

describe('WorkingCopyStores', () => {
  it('reads the store of a runner from its pool, never from the runner', async () => {
    await expect(
      stores({ runner: pool, pool: { workingCopies: STORE } }).ofRunner(
        RunnerId.of('runner_1'),
      ),
    ).resolves.toEqual({ store: 's3://team-a', base: 'base-v1' });
  });

  it('reads the store of a sandbox from the trust of its host', async () => {
    await expect(
      stores({ sandbox: trust, trust: { workingCopies: STORE } }).ofSandbox(
        SandboxId.of('sandbox_1'),
      ),
    ).resolves.toEqual({ store: 's3://team-a', base: 'base-v1' });
  });

  it('names no store for a pool that keeps none, a deleted one, or a runner or sandbox it does not know', async () => {
    await expect(
      stores({ runner: pool, pool: { workingCopies: null } }).ofRunner(
        RunnerId.of('runner_1'),
      ),
    ).resolves.toBeNull();
    await expect(
      stores({
        runner: pool,
        pool: { workingCopies: STORE, isDeleted: true },
      }).ofRunner(RunnerId.of('runner_1')),
    ).resolves.toBeNull();
    await expect(
      stores({}).ofRunner(RunnerId.of('runner_1')),
    ).resolves.toBeNull();
    await expect(
      stores({ sandbox: null }).ofSandbox(SandboxId.of('sandbox_1')),
    ).resolves.toBeNull();
  });
});
