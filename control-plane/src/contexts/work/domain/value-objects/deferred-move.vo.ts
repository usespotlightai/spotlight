import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class DeferredMove {
  private constructor(readonly to: StationId) {}

  static moveTo(to: StationId): DeferredMove {
    return new DeferredMove(to);
  }
}
