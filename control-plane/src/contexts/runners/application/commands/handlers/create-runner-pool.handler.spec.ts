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
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const creating = (key: string) => {
  const added: RunnerPool[] = [];
  const handler = new CreateRunnerPoolHandler(
    {
      permissionsIn: vi.fn(async () => ({
        workspaceId: WorkspaceId.of('ws_1'),
        scopes: new Set(['runners']),
      })),
    } as unknown as WorkspaceAccessPort,
    {
      pool: () => ({
        ok: true,
        key: PoolKey.of(key),
        labels: RunnerLabels.none(),
        maxRuns: null,
        access: { mode: 'pull', token: null, tokenVersion: null },
      }),
    } as unknown as RunnerDefinitionsPort,
    {
      add: vi.fn(async (pool: RunnerPool) => {
        added.push(pool);
      }),
    } as unknown as RunnerPoolRepository,
    {
      take: vi.fn(async () => undefined),
      holderOf: vi.fn(async () => null),
    } as unknown as UsedTokensPort,
    {} as ProvisionSecretsPort,
    {} as EgressRepository,
    null,
    {
      reserve: vi.fn(async () => ({ kind: 'new' as const })),
      recordCreated: vi.fn(async () => undefined),
    } satisfies IdempotentCreatesPort,
    { generate: () => 'pool_1' },
    {
      issue: () => ({ token: 'pool-token', hash: 'a'.repeat(64) }),
      hash: () => 'a'.repeat(64),
    },
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
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
