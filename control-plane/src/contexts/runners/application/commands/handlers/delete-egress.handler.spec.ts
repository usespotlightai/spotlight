import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { DeleteEgressHandler } from '@runners/application/commands/handlers/delete-egress.handler';
import { DeleteEgressCommand } from '@runners/application/commands/runner-resource.commands';
import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import {
  anEgress,
  EGRESS_ID,
} from '@runners/domain/aggregates/egress.fake-spec';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { aPushPool } from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const deleting = (pools: readonly RunnerPool[]) => {
  const egress = anEgress();
  const saved: Egress[] = [];
  const handler = new DeleteEgressHandler(
    partial<WorkspaceAccessPort>({
      permissionsIn: vi.fn(async () => ({
        workspaceId: egress.workspaceId,
        slug: 'acme',
        plans: false,
        configures: false,
        scopes: new Set(['runners'] as const),
        isAdmin: false,
      })),
    }),
    partial<EgressRepository>({
      find: vi.fn(async () => egress),
      findToDelete: vi.fn(async () => egress),
      save: vi.fn(async (each: Egress) => {
        saved.push(each);
      }),
    }),
    partial<RunnerPoolRepository>({
      inWorkspace: vi.fn(async () => pools),
    }),
    partial<TransactionPort>({
      inTransaction: <T>(work: () => Promise<T>) => work(),
    }),
  );

  return { handler, saved };
};

const command = () => new DeleteEgressCommand(EGRESS_ID.value, actorFor(), 0);

describe('DeleteEgressHandler', () => {
  it('deletes an egress that no runner pool names', async () => {
    const { handler, saved } = deleting([aPushPool()]);

    await expect(handler.execute(command())).resolves.toEqual({
      outcome: 'deleted',
    });
    expect(saved[0]?.isDeleted).toBe(true);
  });

  it('does not delete an egress that a runner pool names, and says which', async () => {
    const { handler, saved } = deleting([
      aPushPool({ egress: EgressReference.to(EGRESS_ID) }),
    ]);

    await expect(handler.execute(command())).resolves.toEqual({
      outcome: 'in-use',
      reason: expect.stringContaining(
        'Runner pools that name it: sandboxes',
      ) as unknown,
    });
    expect(saved).toEqual([]);
  });
});
