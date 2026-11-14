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
import {
  type NamedHostImage,
  sandboxImage,
} from '@runners/domain/services/sandbox-image';
import { HostRelease } from '@runners/domain/value-objects/host-release.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

const imagesOn = (host: HostSummary): NamedHostImage[] =>
  host.images.map((each) => ({
    image: RunnerImage.of(each.image),
    digest: each.digest === null ? null : RunnerImage.of(each.digest),
    isDefault: each.isDefault,
  }));

const imageOf = (
  summary: IdleSandboxSummary,
  host: readonly NamedHostImage[],
  lastRanIn: ReadonlyMap<string, string>,
): string | null => {
  const ranIn = summary.key === null ? undefined : lastRanIn.get(summary.key);

  return (
    sandboxImage(
      summary.warmLineId === null
        ? {
            warm: false,
            lastRanIn: ranIn === undefined ? null : RunnerImage.of(ranIn),
          }
        : {
            warm: true,
            placement:
              summary.warmImage === null
                ? null
                : RunnerImage.of(summary.warmImage),
          },
      host,
    )?.value ?? null
  );
};

const idleSandbox = (
  summary: IdleSandboxSummary,
  host: HostSummary,
  online: boolean,
  images: readonly NamedHostImage[],
  lastRanIn: ReadonlyMap<string, string>,
): IdleSandboxDto => {
  return {
    id: summary.id,
    workingCopyKey: summary.key,
    warmLineId: summary.warmLineId,
    image: imageOf(summary, images, lastRanIn),
    status: Sandbox.statusFrom({
      state: summary.state,
      placedOnHost: summary.hostId === host.id,
      hostOnline: online,
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
      slotsOffered: number;
      idleSandboxes: readonly IdleSandboxSummary[];
      lastRanIn: ReadonlyMap<string, string>;
    },
  ): HostDto {
    const images = imagesOn(summary);

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
      slotsOffered: on.slotsOffered,
      idleSandboxes: on.idleSandboxes.map((each) =>
        idleSandbox(each, summary, online, images, on.lastRanIn),
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
