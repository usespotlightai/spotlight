import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';

export const keyTaken = (existing: readonly Line[], key: LineKey): boolean =>
  existing.some((each) => each.key.equals(key));
