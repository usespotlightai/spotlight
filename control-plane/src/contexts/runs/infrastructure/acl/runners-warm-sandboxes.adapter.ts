import type { WarmSandboxesPort } from '@runners/application/ports/warm-sandboxes.port';
import type { WarmSandboxKeepingPort } from '@runs/application/ports/warm-sandbox-keeping.port';
import type {
  KeptWarmSandbox,
  WarmSandboxRequest,
} from '@runs/domain/services/warm-sandbox-demand';
import { WarmFingerprint } from '@runs/domain/value-objects/warm-fingerprint.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export class RunnersWarmSandboxKeeping implements WarmSandboxKeepingPort {
  constructor(private readonly sandboxes: WarmSandboxesPort) {}

  async kept(): Promise<readonly KeptWarmSandbox[]> {
    return (await this.sandboxes.kept()).map((each) => ({
      id: each.id,
      lineId: LineId.of(each.lineId),
      fingerprint: WarmFingerprint.of(each.fingerprint),
      placed: each.placed,
    }));
  }

  async linesLostSince(cutoff: Date): Promise<readonly LineId[]> {
    return (await this.sandboxes.linesLostSince(cutoff)).map((each) =>
      LineId.of(each),
    );
  }

  request({ line, fingerprint }: WarmSandboxRequest, at: Date): Promise<void> {
    return this.sandboxes.request(
      {
        workspaceId: line.workspaceId.value,
        lineId: line.id.value,
        placement: {
          labelGroups: line.placement.labelGroups,
          image: line.placement.image?.value ?? null,
        },
        checkouts: line.checkouts,
        fingerprint: fingerprint.value,
      },
      at,
    );
  }

  retire(sandboxId: string): Promise<void> {
    return this.sandboxes.retire(sandboxId);
  }
}
