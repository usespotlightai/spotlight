import type {
  KeptWarmSandbox,
  WarmSandboxRequest,
} from '@runs/domain/services/warm-sandbox-demand';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export const WARM_SANDBOX_KEEPING = Symbol('WARM_SANDBOX_KEEPING');

export interface WarmSandboxKeepingPort {
  kept(): Promise<readonly KeptWarmSandbox[]>;

  linesLostSince(cutoff: Date): Promise<readonly LineId[]>;

  request(request: WarmSandboxRequest, at: Date): Promise<void>;

  retire(sandboxId: string): Promise<void>;
}
