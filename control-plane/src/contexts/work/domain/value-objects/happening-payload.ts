import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';

type HappeningState = 'raised' | 'resolved';

export interface HappeningPayload {
  readonly happening: Happening;
  readonly summary: string;
  readonly answers: boolean;
  readonly state: HappeningState;
}
