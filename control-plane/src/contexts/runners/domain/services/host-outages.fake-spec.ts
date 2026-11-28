import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPullPool,
  aSandboxReport,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';

export const MINUTE = 60_000;

export const minutesAfter = (minutes: number): Date =>
  new Date(STARTED_AT.getTime() + minutes * MINUTE);

// A host named after itself that last reported in at a minute after STARTED_AT, and runs the harnesses.
export const aNamedHost = (
  name: string,
  input: {
    readonly lastAt?: number;
    readonly through?: RunnerPool | RunnerTrust;
    readonly harnesses?: readonly string[];
  } = {},
): RunnerHost => {
  const through = input.through ?? aPullPool();

  return RunnerHost.fromHeartbeat({
    id: HostId.of(`host-${name}-0000000000`),
    workspaceId: through.workspaceId,
    source: CredentialSource.ofId(through.id),
    bootId: BootId.of('boot_1'),
    report: HostReport.of({
      name,
      release: '0.9.0',
      containerRuntime: 'docker',
      capacity: 6,
      running: [],
      images: [
        {
          image: 'ghcr.io/acme/runner:main',
          isDefault: true,
          harnesses: (input.harnesses ?? ['claude-code']).map((id) => ({
            id,
            models: [],
          })),
        },
      ],
    }),
    sandboxes: aSandboxReport(),
    at: minutesAfter(input.lastAt ?? 0),
  });
};
