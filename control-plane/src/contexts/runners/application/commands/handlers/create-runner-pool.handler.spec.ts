import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { CreateRunnerPoolHandler } from '@runners/application/commands/handlers/create-runner-pool.handler';
import { CreateRunnerPoolCommand } from '@runners/application/commands/runner-resource.commands';
import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import type { UsedTokensPort } from '@runners/application/ports/used-tokens.port';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const creating = (key: string) => {
  const added: RunnerPool[] = [];
  const handler = new CreateRunnerPoolHandler(
    partial<WorkspaceAccessPort>({
      permissionsIn: vi.fn(() =>
        Promise.resolve({
          workspaceId: WorkspaceId.of('ws_1'),
          slug: 'acme',
          plans: false,
          configures: false,
          scopes: new Set(['runners'] as const),
          isAdmin: false,
        }),
      ),
    }),
    partial<RunnerDefinitionsPort>({
      pool: () => ({
        ok: true,
        key: PoolKey.of(key),
        labels: RunnerLabels.none(),
        maxRuns: null,
        access: { mode: 'pull', token: null, tokenVersion: null },
        workingCopies: null,
      }),
    }),
    partial<RunnerPoolRepository>({
      add: vi.fn((pool: RunnerPool) => {
        added.push(pool);
        return Promise.resolve();
      }),
    }),
    partial<UsedTokensPort>({}),
    partial<ProvisionSecretsPort>({}),
    partial<EgressRepository>({}),
    null,
    {
      reserve: vi.fn(() => Promise.resolve({ kind: 'new' as const })),
      recordCreated: vi.fn(() => Promise.resolve(undefined)),
    } satisfies IdempotentCreatesPort,
    { generate: () => 'pool_1' },
    {
      issue: () => ({ token: 'pool-token', hash: 'a'.repeat(64) }),
      hash: () => 'a'.repeat(64),
    },
    partial<TransactionPort>({
      inTransaction: <T>(work: () => Promise<T>) => work(),
    }),
  );

  return {
    added,
    created: handler.execute(
      new CreateRunnerPoolCommand('ws_1', actorFor(), 'key_1', {}),
    ),
  };
};

describe('CreateRunnerPoolHandler', () => {
  it('refuses a pool with the key of the platform pool, and adds none', async () => {
    const { added, created } = creating('spotlight');

    await expect(created).resolves.toMatchObject({
      created: {
        outcome: 'invalid',
        problems: [
          expect.objectContaining({
            reason: expect.stringContaining(
              'the key of the platform pool that Spotlight adds to each workspace',
            ) as unknown,
          }),
        ],
      },
      token: null,
    });
    expect(added).toEqual([]);
  });
});
