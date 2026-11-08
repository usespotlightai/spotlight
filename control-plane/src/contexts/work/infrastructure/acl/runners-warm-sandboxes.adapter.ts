import type { WarmSandboxesPort } from '@runners/application/ports/warm-sandboxes.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { WarmSandboxKeepingPort } from '@work/application/ports/warm-sandbox-keeping.port';
import {
  type KeptWarmSandbox,
  type WarmSandboxRequest,
  warmCheckoutsOf,
} from '@work/domain/services/warm-sandbox-demand';
import { WarmFingerprint } from '@work/domain/value-objects/warm-fingerprint.vo';

export class RunnersWarmSandboxKeeping implements WarmSandboxKeepingPort {
  constructor(private readonly sandboxes: WarmSandboxesPort) {}

  async kept(): Promise<readonly KeptWarmSandbox[]> {
    return (await this.sandboxes.kept()).map((each) => ({
      id: each.id,
      lineId: LineId.of(each.lineId),
      fingerprint: WarmFingerprint.of(each.fingerprint),
    }));
  }

  async linesLostSince(cutoff: Date): Promise<readonly LineId[]> {
    return (await this.sandboxes.linesLostSince(cutoff)).map((each) =>
      LineId.of(each),
    );
  }

  request({ line, fingerprint }: WarmSandboxRequest, at: Date): Promise<void> {
    const placement = line.runsIn;

    return this.sandboxes.request(
      {
        workspaceId: line.workspaceId.value,
        lineId: line.id.value,
        placement: {
          labelGroups: placement.labelGroups,
          image: placement.image?.value ?? null,
        },
        checkouts: warmCheckoutsOf(line),
        fingerprint: fingerprint.value,
      },
      at,
    );
  }

  retire(sandboxId: string): Promise<void> {
    return this.sandboxes.retire(sandboxId);
  }
}
