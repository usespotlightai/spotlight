import type { WarmSlotsPort } from '@runners/application/ports/warm-slots.port';
import { occupancyOnHost } from '@runners/application/services/pool-occupancy';
import { reviseOrRemoveSandbox } from '@runners/application/services/sandbox-revisions';
import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { WarmSlots } from '@runners/domain/services/warm-slots';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

interface HostSlots {
  readonly host: RunnerHost;
  readonly onHost: readonly Sandbox[];
  readonly alive: readonly Runner[];
}

export class HostWarmSlots implements WarmSlotsPort {
  constructor(
    private readonly sandboxes: SandboxRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly runners: RunnerRepository,
    private readonly logger: LoggerPort,
  ) {}

  async roomForWarmOn(hostId: string, at: Date): Promise<boolean> {
    const slots = await this.slotsOn(hostId, at);

    return (
      slots !== null &&
      WarmSlots.roomForWarm(slots.host, this.occupancyOf(slots))
    );
  }

  async drainWarmOn(hostId: string, at: Date): Promise<void> {
    const slots = await this.slotsOn(hostId, at);
    const chosen =
      slots &&
      WarmSlots.toDrainForQueuedRun(
        slots.host,
        this.occupancyOf(slots),
        slots.alive.filter(
          (each) =>
            (each.hostId?.equals(slots.host.id) ?? false) &&
            each.isOpenClaimAt(at),
        ).length,
        slots.onHost,
        at,
      );

    if (!slots || !chosen) {
      return;
    }

    const drained = await reviseOrRemoveSandbox(
      this.sandboxes,
      chosen,
      (sandbox) => sandbox.drainedForQueuedRun(slots.host, at),
    );

    if (drained.kind === 'saved') {
      this.logger.info(
        {
          sandboxId: chosen.id.value,
          hostId,
          lineId: chosen.warm?.lineId.value ?? null,
        },
        'Draining a warm sandbox so a queued run can take its slot',
      );
    }
  }

  private async slotsOn(hostId: string, at: Date): Promise<HostSlots | null> {
    const host = await this.hosts.find(HostId.of(hostId));

    if (!host) {
      return null;
    }

    const [onHost, alive] = await Promise.all([
      this.sandboxes.liveOn(host.id),
      this.runners.aliveInWorkspace(host.workspaceId, at),
    ]);

    return { host, onHost, alive };
  }

  private occupancyOf({ host, onHost, alive }: HostSlots) {
    return occupancyOnHost(
      host.id,
      alive,
      onHost.filter((each) => each.isIdle).map((each) => each.id),
    );
  }
}
