import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class ProposalPlacement {
  private constructor(
    readonly lineId: LineId,
    readonly stationId: StationId,
  ) {}

  static of(input: {
    lineId: LineId;
    stationId: StationId;
  }): ProposalPlacement {
    return new ProposalPlacement(input.lineId, input.stationId);
  }

  equals(other: ProposalPlacement): boolean {
    return (
      this.lineId.equals(other.lineId) && this.stationId.equals(other.stationId)
    );
  }
}
