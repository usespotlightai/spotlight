import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
export class InboxAsk {
  private constructor(
    readonly stationId: StationId,
    readonly at: Date,
  ) {}

  static of(stationId: StationId, at: Date): InboxAsk {
    return new InboxAsk(stationId, at);
  }

  equals(other: InboxAsk): boolean {
    return (
      this.stationId.equals(other.stationId) &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
