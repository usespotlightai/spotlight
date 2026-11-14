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

const idleSandbox = (
  summary: IdleSandboxSummary,
  host: HostSummary,
  online: boolean,
): IdleSandboxDto => {
  return {
    id: summary.id,
    workingCopyKey: summary.key,
    warmLineId: summary.warmLineId,
    status: Sandbox.statusFrom({
      state: summary.state,
      liveOnHost: online,
      reportedByHost: host.reportedSandboxes.includes(summary.id),
    }),
    idleSince: summary.idleSince.toISOString(),
    startedAt: summary.startedAt.toISOString(),
  };
};

export const RunnerFleetMapper = {
  host(
    summary: HostSummary,
    online: boolean,
    on: {
      slotsTaken: number;
      idleSandboxes: readonly IdleSandboxSummary[];
    },
  ): HostDto {
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
      slotsTaken: on.slotsTaken,
      idleSandboxes: on.idleSandboxes.map((each) =>
        idleSandbox(each, summary, online),
      ),
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
