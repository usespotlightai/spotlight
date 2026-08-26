import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';

export interface AssemblyLineRepository {
  add(line: AssemblyLine): Promise<void>;

  save(line: AssemblyLine): Promise<void>;

  find(id: AssemblyLineId): Promise<AssemblyLine | null>;
}
