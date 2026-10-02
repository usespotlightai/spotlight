import type { StartingPointHold } from '@work/domain/aggregates/starting-point-hold.aggregate';

export interface StartingPointHoldRepository {
  find(holder: string): Promise<StartingPointHold | null>;

  add(hold: StartingPointHold): Promise<void>;

  save(hold: StartingPointHold): Promise<void>;
}
