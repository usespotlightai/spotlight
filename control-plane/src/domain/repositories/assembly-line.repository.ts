import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';

export interface AssemblyLineRepository {
  add(line: AssemblyLine): Promise<void>;
}
