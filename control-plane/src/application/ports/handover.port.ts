import type { Run } from '@domain/aggregates/run.aggregate';

export const HANDOVER = Symbol('HANDOVER');

export interface HandoverPort {
  handOver(run: Run): Promise<void>;
}
