import type {
  HostDto,
  IdleSandboxDto,
  LiveRunnerDto,
} from '@runners/application/dto/runner-fleet.dto';
import type {
  HostSummary,
  IdleSandboxSummary,
  LiveRunnerSummary,
} from '@runners/application/ports/runner-reader.port';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { HostRelease } from '@runners/domain/value-objects/host-release.vo';
import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

const idleSandbox = (
  summary: IdleSandboxSummary,
  host: HostSummary,
  online: boolean,
): IdleSandboxDto => {
  return {
    id: summary.id,
    key: summary.key,
    warmLineId: summary.warmLineId,
    status: summary.draining
      ? 'draining'
      : Sandbox.openStatus(
          online && host.reportedSandboxes.includes(summary.id),
        ),
    idleSince: summary.idleSince.toISOString(),
    startedAt: summary.startedAt.toISOString(),
  };
};

export const RunnerFleetMapper = {
  host(
    summary: HostSummary,
    online: boolean,
    on: {
      runners: readonly LiveRunnerSummary[];
      idleSandboxes: readonly IdleSandboxSummary[];
    },
  ): HostDto {
    const runners = on.runners.filter((each) => each.hostId === summary.id);
    const idle = on.idleSandboxes.filter((each) => each.hostId === summary.id);

    return {
      id: summary.id,
      name: summary.name,
      source: summary.source,
      release: summary.release,
      unavailableReason: HostRelease.of(summary.release).isOutdated
        ? `Host is on release ${summary.release}. Minimum release required: ${HostRelease.MINIMUM.value}. Update it with: spotlight update`
        : null,
      containerRuntime: summary.containerRuntime,
      capacity: summary.capacity,
      slotsTaken: PoolOccupancy.of({
        runners: runners.length,
        entered: runners.flatMap((each) =>
          each.enters ? [SandboxId.of(each.enters)] : [],
        ),
        idleSandboxes: idle.map((each) => SandboxId.of(each.id)),
      }).taken,
      idleSandboxes: idle.map((each) => idleSandbox(each, summary, online)),
      images: summary.images,
      firstHeartbeatAt: summary.firstHeartbeatAt.toISOString(),
      onlineSince: summary.onlineSince.toISOString(),
      lastHeartbeatAt: summary.lastHeartbeatAt.toISOString(),
      online,
    };
  },

  runner(summary: LiveRunnerSummary): LiveRunnerDto {
    return {
      id: summary.id,
      source: summary.source,
      hostId: summary.hostId,
      image: summary.image,
      harnesses: summary.harnesses,
      startedAt: summary.startedAt.toISOString(),
      lastHeartbeatAt: summary.lastHeartbeatAt?.toISOString() ?? null,
    };
  },
};
