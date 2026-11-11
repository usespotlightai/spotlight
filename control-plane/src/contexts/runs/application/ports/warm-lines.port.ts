import type { WarmLine } from '@runs/domain/value-objects/warm-line.vo';

export const WARM_LINES = Symbol('WARM_LINES');

export interface WarmLinesPort {
  keepingWarmSandboxes(): Promise<readonly WarmLine[]>;
}
