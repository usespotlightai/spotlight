import { EGRESS_ID } from '@runners/domain/aggregates/egress.fake-spec';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import {
  aHost,
  aPlatformPool,
  aPullPool,
  aPushPool,
  aSandboxReport,
  HOST_ID,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import {
  type WorkspaceRunnerFacts,
  WorkspaceReadiness,
} from '@runners/domain/services/workspace-readiness';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const DAY = 24 * 60 * 60_000;

const facts = (
  over: Partial<WorkspaceRunnerFacts> = {},
): WorkspaceRunnerFacts => ({
  pools: [],
  hosts: [],
  platform: { poolSet: true, egressSet: true },
  now: STARTED_AT,
  ...over,
});

const aHostWithoutHarness = (): RunnerHost =>
  RunnerHost.fromHeartbeat({
    id: HOST_ID,
    workspaceId: WorkspaceId.of('ws_1'),
    source: CredentialSource.ofId(aPullPool().id),
    bootId: BootId.of('boot_1'),
    report: HostReport.of({
      name: 'build-box',
      release: '0.9.0',
      containerRuntime: 'docker',
      capacity: 4,
      running: [],
      images: [
        { image: 'ghcr.io/acme/bare:1', isDefault: true, harnesses: [] },
      ],
    }),
    sandboxes: aSandboxReport(),
    at: STARTED_AT,
  });

describe('WorkspaceReadiness', () => {
  it('is not ready with no pool and no host, nor with only a pull pool', () => {
    expect(WorkspaceReadiness.readyToRun(facts())).toBe(false);
    expect(WorkspaceReadiness.readyToRun(facts({ pools: [aPullPool()] }))).toBe(
      false,
    );
  });

  it('is ready with a pool that provisions, as RunnerPool.canProvision decides', () => {
    expect(WorkspaceReadiness.readyToRun(facts({ pools: [aPushPool()] }))).toBe(
      true,
    );
    expect(
      WorkspaceReadiness.readyToRun(facts({ pools: [aPlatformPool()] })),
    ).toBe(true);
    expect(
      WorkspaceReadiness.readyToRun(
        facts({
          pools: [aPlatformPool()],
          platform: { poolSet: false, egressSet: true },
        }),
      ),
    ).toBe(false);
    expect(
      WorkspaceReadiness.readyToRun(
        facts({ pools: [aPlatformPool({ disabled: true })] }),
      ),
    ).toBe(false);
  });

  it('is ready with a host that serves a harness until it is stale', () => {
    expect(WorkspaceReadiness.readyToRun(facts({ hosts: [aHost()] }))).toBe(
      true,
    );
    expect(
      WorkspaceReadiness.readyToRun(
        facts({
          hosts: [aHost()],
          now: new Date(STARTED_AT.getTime() + DAY),
        }),
      ),
    ).toBe(false);
    expect(
      WorkspaceReadiness.readyToRun(facts({ hosts: [aHostWithoutHarness()] })),
    ).toBe(false);
  });

  it('is ready for work that needs egress with a host, or a pool that provisions with egress', () => {
    expect(WorkspaceReadiness.readyForEgress(facts({ hosts: [aHost()] }))).toBe(
      true,
    );
    expect(
      WorkspaceReadiness.readyForEgress(facts({ pools: [aPushPool()] })),
    ).toBe(false);
    expect(
      WorkspaceReadiness.readyForEgress(
        facts({
          pools: [aPushPool({ egress: EgressReference.to(EGRESS_ID) })],
        }),
      ),
    ).toBe(true);
  });

  it('keeps the platform pool from work that needs egress until the operator allows it secrets', () => {
    const egress = EgressReference.platform();
    const withheld = facts({ pools: [aPlatformPool({ egress })] });

    expect(WorkspaceReadiness.readyToRun(withheld)).toBe(true);
    expect(WorkspaceReadiness.readyForEgress(withheld)).toBe(false);
    expect(
      WorkspaceReadiness.readyForEgress(
        facts({
          pools: [aPlatformPool({ egress, allows: { allowsSecrets: true } })],
        }),
      ),
    ).toBe(true);
  });

  it('gives platform runners while the deployment sets the provisioner and the operator did not disable the pool, also before the pool is there', () => {
    expect(WorkspaceReadiness.hasPlatformRunners(facts())).toBe(true);
    expect(
      WorkspaceReadiness.hasPlatformRunners(
        facts({ pools: [aPlatformPool()] }),
      ),
    ).toBe(true);
    expect(
      WorkspaceReadiness.hasPlatformRunners(
        facts({ pools: [aPlatformPool({ disabled: true })] }),
      ),
    ).toBe(false);
    expect(
      WorkspaceReadiness.hasPlatformRunners(
        facts({ platform: { poolSet: false, egressSet: true } }),
      ),
    ).toBe(false);
  });
});
