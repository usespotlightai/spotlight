import { AbandonWorkspaceRunners } from '@runners/application/services/abandon-workspace-runners.service';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_closed');
const NOW = new Date('2026-09-24T10:00:00.000Z');

const runner = Runner.rehydrate({
  id: RunnerId.of('runner_1'),
  workspaceId: WORKSPACE,
  name: RunnerName.of('build-1'),
  tokenHash: TokenHash.of('a'.repeat(64)),
  installed: [],
  revokedAt: null,
  lastSeenAt: null,
  version: 0,
});

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
  runners: [RunnerName.of('build-1')],
  trusts: [],
  version: 0,
});

const abandoning = () => {
  const saved: { pullEvents(): DomainEvent[] }[] = [];
  const save = vi.fn(async (each: (typeof saved)[number]) => {
    saved.push(each);
  });
  const service = new AbandonWorkspaceRunners(
    {
      standingIn: async () => [runner],
      find: async () => runner,
      save,
    } as unknown as RunnerRepository,
    {
      inWorkspace: async () => [trust],
      save,
    } as unknown as RunnerTrustRepository,
    {
      declaredIn: async () => declared,
      save,
    } as unknown as WorkspaceRunnersRepository,
    { now: () => NOW } as ClockPort,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
  );

  const changes = () =>
    saved
      .flatMap((each) => each.pullEvents())
      .filter(changesConfiguration)
      .map(({ change }) => [change.resource, change.action, change.by.actor]);

  return { service, changes };
};

describe('AbandonWorkspaceRunners', () => {
  it('revokes the runners a closed workspace still has, as Spotlight', async () => {
    const { service, changes } = abandoning();

    await service.runnersOf(WORKSPACE);

    expect(changes()).toEqual([['runner', 'deleted', null]]);
  });

  it('withdraws the trusts a closed workspace still has, as Spotlight', async () => {
    const { service, changes } = abandoning();

    await service.trustsOf(WORKSPACE);

    expect(changes()).toEqual([['runner-trust', 'deleted', null]]);
  });

  it('drops what a closed workspace declared of its runners, as Spotlight', async () => {
    const { service, changes } = abandoning();

    await service.declarationOf(WORKSPACE);

    expect(changes()).toEqual([['workspace-runners', 'deleted', null]]);
  });
});
