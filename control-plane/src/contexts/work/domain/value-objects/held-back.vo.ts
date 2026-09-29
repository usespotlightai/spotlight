import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class HeldBack {
  private constructor(readonly to: StationId | null) {}

  static moveTo(to: StationId): HeldBack {
    return new HeldBack(to);
  }

  static cleared(): HeldBack {
    return new HeldBack(null);
  }

  get clears(): boolean {
    return this.to === null;
  }
}
