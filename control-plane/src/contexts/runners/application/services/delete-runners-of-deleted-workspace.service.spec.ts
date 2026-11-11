import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { DeleteRunnersOfDeletedWorkspace } from '@runners/application/services/delete-runners-of-deleted-workspace.service';
import { anEgress } from '@runners/domain/aggregates/egress.fake-spec';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPullPool,
  aPushPool,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_deleted');

const trust = RunnerTrust.rehydrate({
  id: RunnerTrustId.of('trust_1'),
  workspaceId: WORKSPACE,
  key: TrustKey.of('production'),
  workload: TrustedWorkload.of({
    issuer: 'https://oidc.example.com',
    subject: 'runner',
    audience: 'spotlight',
  }),
  labels: RunnerLabels.none(),
  version: 0,
});

const declared = WorkspaceRunners.rehydrate({
  id: WorkspaceRunnersId.of('declared_1'),
  workspaceId: WORKSPACE,
  trusts: [TrustKey.of('production')],
  pools: [],
  version: 0,
});

const pool = aPullPool();
pool.pullEvents();

const egress = anEgress({ workspaceId: WORKSPACE });
egress.pullEvents();

const deleting = (
  input: { open?: boolean; naming?: readonly RunnerPool[] } = {},
) => {
  const open = input.open ?? false;
  const saved: { pullEvents(): DomainEvent[] }[] = [];
  const save = vi.fn(async (each: (typeof saved)[number]) => {
    saved.push(each);
  });
  const service = new DeleteRunnersOfDeletedWorkspace(
    {
      inWorkspace: async () => [trust],
      save,
    } as unknown as RunnerTrustRepository,
    {
      ofWorkspace: async () => declared,
      save,
    } as unknown as WorkspaceRunnersRepository,
    {
      inWorkspace: async () => input.naming ?? [pool],
      save,
    } as unknown as RunnerPoolRepository,
    {
      inWorkspace: async () => [egress],
      save,
    } as unknown as EgressRepository,
    { isOpen: async () => open } as unknown as WorkspaceReaderPort,
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
  );

  const changes = () =>
    saved
      .flatMap((each) => each.pullEvents())
      .filter(changesConfiguration)
      .map(({ change }) => [change.resource, change.action, change.by.actor]);

  return { service, changes };
};

describe('DeleteRunnersOfDeletedWorkspace', () => {
  it('deletes the trusts a deleted workspace still has, as Spotlight', async () => {
    const { service, changes } = deleting();

    await service.trustsOf(WORKSPACE);

    expect(changes()).toEqual([['runner-trust', 'deleted', null]]);
  });

  it('deletes the pools a deleted workspace still has, as Spotlight', async () => {
    const { service, changes } = deleting();

    await service.poolsOf(WORKSPACE);

    expect(changes()).toEqual([['runner-pool', 'deleted', null]]);
  });

  it('deletes the egresses a deleted workspace still has once no pool names them, as Spotlight', async () => {
    const { service, changes } = deleting();

    await service.egressesOf(WORKSPACE);

    expect(changes()).toEqual([['egress', 'deleted', null]]);
  });

  it('leaves an egress a pool still names, for the deletion of that pool to take it', async () => {
    const naming = aPushPool({ egress: EgressReference.to(egress.id) });
    naming.pullEvents();
    const { service, changes } = deleting({ naming: [naming] });

    await service.egressesOf(WORKSPACE);

    expect(changes()).toEqual([]);
  });

  it('deletes the egresses of a deleted workspace once a pool of it is deleted', async () => {
    const { service, changes } = deleting();

    await service.egressesAfterPoolOf(WORKSPACE);

    expect(changes()).toEqual([['egress', 'deleted', null]]);
  });

  it('keeps the egresses of an open workspace when one of its pools is deleted', async () => {
    const { service, changes } = deleting({ open: true });

    await service.egressesAfterPoolOf(WORKSPACE);

    expect(changes()).toEqual([]);
  });

  it('deletes the workspace runners of a deleted workspace, as Spotlight', async () => {
    const { service, changes } = deleting();

    await service.workspaceRunnersOf(WORKSPACE);

    expect(changes()).toEqual([['workspace-runners', 'deleted', null]]);
  });
});
