import type {
  KeptWarmSandbox,
  WarmSandboxesPort,
  WarmSandboxOrder,
} from '@runners/application/ports/warm-sandboxes.port';
import { reviseSandbox } from '@runners/application/services/sandbox-revisions';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const warmPartOf = (order: WarmSandboxOrder): WarmPart =>
  WarmPart.of({
    lineId: LineId.of(order.lineId),
    placement: RunnerPlacement.ofLabelGroups(
      order.placement.labelGroups,
      order.placement.image === null
        ? null
        : RunnerImage.of(order.placement.image),
    ),
    checkouts: order.checkouts,
    fingerprint: order.fingerprint,
  });

export class WarmSandboxes implements WarmSandboxesPort {
  constructor(
    private readonly sandboxes: SandboxRepository,
    private readonly ids: IdGeneratorPort,
    private readonly logger: LoggerPort,
  ) {}

  async kept(): Promise<readonly KeptWarmSandbox[]> {
    return (await this.sandboxes.openWarm()).flatMap((sandbox) =>
      sandbox.warm
        ? [
            {
              id: sandbox.id.value,
              workspaceId: sandbox.workspaceId.value,
              lineId: sandbox.warm.lineId.value,
              fingerprint: sandbox.warm.fingerprint,
              placed: sandbox.isPlaced,
            },
          ]
        : [],
    );
  }

  async linesLostSince(cutoff: Date): Promise<readonly string[]> {
    const lines = (await this.sandboxes.lostWarmSince(cutoff)).flatMap(
      (sandbox) =>
        sandbox.warm && sandbox.lostWhileWarm
          ? [sandbox.warm.lineId.value]
          : [],
    );

    return [...new Set(lines)];
  }

  async request(order: WarmSandboxOrder, at: Date): Promise<void> {
    const requested = Sandbox.requestWarm({
      id: SandboxId.of(this.ids.generate()),
      workspaceId: WorkspaceId.of(order.workspaceId),
      warm: warmPartOf(order),
      at,
    });

    await this.sandboxes.add(requested);

    this.logger.info(
      {
        sandboxId: requested.id.value,
        workspaceId: order.workspaceId,
        lineId: order.lineId,
      },
      'Requested a warm sandbox',
    );
  }

  async retire(sandboxId: string): Promise<void> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (!found?.isWarm) {
      return;
    }

    if (found.isRequested) {
      await this.sandboxes.remove(found).catch((error: unknown) => {
        if (!(error instanceof SandboxVersionConflictError)) {
          throw error;
        }
      });
      return;
    }

    await reviseSandbox(this.sandboxes, found, (sandbox) =>
      sandbox.isWarm ? sandbox.drain() : sandbox,
    );

    this.logger.info(
      { sandboxId, hostId: found.hostId?.value ?? null },
      'Draining a warm sandbox its line no longer needs',
    );
  }
}
