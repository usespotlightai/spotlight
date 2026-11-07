import type { StartingPointHold } from '@runs/domain/aggregates/starting-point-hold.aggregate';
import type { HoldHolder } from '@runs/domain/value-objects/hold-holder.vo';

export interface StartingPointHoldRepository {
  find(holder: HoldHolder): Promise<StartingPointHold | null>;

  add(hold: StartingPointHold): Promise<void>;

  save(hold: StartingPointHold): Promise<void>;
}
