import type { HostSlotLocksPort } from '@runners/application/ports/host-slot-locks.port';
import type { WarmSlotsPort } from '@runners/application/ports/warm-slots.port';
import { reviseOrRemoveSandbox } from '@runners/application/services/sandbox-revisions';
import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { HostSlotHolders } from '@runners/domain/services/host-slot-holders';
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
    private readonly locks: HostSlotLocksPort,
    private readonly logger: LoggerPort,
  ) {}

  startWarmIfRoomOn<T>(
    hostId: string,
    at: Date,
    start: () => Promise<T | null>,
  ): Promise<T | null> {
    return this.locks.holding(hostId, async () => {
      const slots = await this.slotsOn(hostId, at);

      return slots &&
        WarmSlots.roomForWarm(slots.host, this.holdersOf(slots, at))
        ? start()
        : null;
    });
  }

  async drainWarmOn(
    hostId: string,
    at: Date,
    runWaits: () => Promise<boolean>,
  ): Promise<void> {
    if (!(await this.toDrainOn(hostId, at)) || !(await runWaits())) {
      return;
    }

    await this.locks.holding(hostId, async () => {
      const found = await this.toDrainOn(hostId, at);

      if (!found) {
        return;
      }

      const drained = await reviseOrRemoveSandbox(
        this.sandboxes,
        found.chosen,
        (sandbox) => sandbox.drainedForQueuedRun(found.host, at),
      );

      if (drained.kind === 'saved') {
        this.logger.info(
          {
            sandboxId: found.chosen.id.value,
            hostId,
            lineId: found.chosen.warm?.lineId.value ?? null,
          },
          'Draining a warm sandbox so a queued run can take its slot',
        );
      }
    });
  }

  private async toDrainOn(
    hostId: string,
    at: Date,
  ): Promise<{ host: RunnerHost; chosen: Sandbox } | null> {
    const slots = await this.slotsOn(hostId, at);
    const chosen =
      slots &&
      WarmSlots.toDrainForQueuedRun(
        slots.host,
        this.holdersOf(slots, at),
        slots.onHost,
        at,
      );

    return slots && chosen ? { host: slots.host, chosen } : null;
  }

  private async slotsOn(hostId: string, at: Date): Promise<HostSlots | null> {
    const host = await this.hosts.find(HostId.of(hostId));

    if (!host) {
      return null;
    }

    const onHost = await this.sandboxes.liveOn(host.id);
    const alive = await this.runners.aliveInWorkspace(host.workspaceId, at);

    return { host, onHost, alive };
  }

  private holdersOf(
    { host, onHost, alive }: HostSlots,
    at: Date,
  ): HostSlotHolders {
    return HostSlotHolders.on(
      host.id,
      alive,
      onHost.filter((each) => each.isIdle).map((each) => each.id),
      at,
    );
  }
}
