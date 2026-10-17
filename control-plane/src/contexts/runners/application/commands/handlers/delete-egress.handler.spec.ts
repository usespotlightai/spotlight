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
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const deleting = (pools: readonly RunnerPool[]) => {
  const egress = anEgress();
  const saved: Egress[] = [];
  const handler = new DeleteEgressHandler(
    {
      permissionsIn: vi.fn(async () => ({
        workspaceId: egress.workspaceId,
        managesRunners: true,
      })),
    } as unknown as WorkspaceAccessPort,
    {
      find: vi.fn(async () => egress),
      findToRetire: vi.fn(async () => egress),
      save: vi.fn(async (each: Egress) => {
        saved.push(each);
      }),
    } as unknown as EgressRepository,
    {
      inWorkspace: vi.fn(async () => pools),
    } as unknown as RunnerPoolRepository,
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
  );

  return { handler, saved };
};

const command = () => new DeleteEgressCommand(EGRESS_ID.value, actorFor(), 0);

describe('DeleteEgressHandler', () => {
  it('retires an egress that no runner pool names', async () => {
    const { handler, saved } = deleting([aPushPool()]);

    await expect(handler.execute(command())).resolves.toEqual({
      outcome: 'deleted',
    });
    expect(saved[0]?.isRetired).toBe(true);
  });

  it('does not retire an egress that a runner pool names, and says which', async () => {
    const { handler, saved } = deleting([
      aPushPool({ egress: EgressReference.to(EGRESS_ID) }),
    ]);

    await expect(handler.execute(command())).resolves.toEqual({
      outcome: 'in-use',
      reason: expect.stringContaining('Runner pools that name it: sandboxes'),
    });
    expect(saved).toEqual([]);
  });
});
