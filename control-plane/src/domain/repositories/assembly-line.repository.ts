import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

export interface AssemblyLineRepository {
  add(line: AssemblyLine): Promise<void>;

  save(line: AssemblyLine): Promise<void>;

  find(id: AssemblyLineId): Promise<AssemblyLine | null>;

  holding(stationId: StationId): Promise<AssemblyLine | null>;
}
