import type { Run } from '@domain/aggregates/run.aggregate';
import type { Declaration } from '@domain/value-objects/declaration.vo';

export const HANDOVER = Symbol('HANDOVER');

export interface HandoverPort {
  handOver(run: Run, declared?: Declaration | null): Promise<void>;
}
