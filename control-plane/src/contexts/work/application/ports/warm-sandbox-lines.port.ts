import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export const WARM_SANDBOX_LINES = Symbol('WARM_SANDBOX_LINES');

export interface WarmSandboxLinesPort {
  keepingWarmSandboxes(): Promise<readonly LineMap[]>;
}
