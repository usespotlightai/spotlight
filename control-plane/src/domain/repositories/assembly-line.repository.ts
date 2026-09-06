import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface AssemblyLineRepository {
  add(line: AssemblyLine): Promise<void>;

  save(line: AssemblyLine): Promise<void>;

  find(id: AssemblyLineId): Promise<AssemblyLine | null>;

  holding(stationId: StationId): Promise<AssemblyLine | null>;

  /**
   * Every line a workspace runs, so configuration describing one can find
   * the one it describes. Matched by key: the file names a line the way a
   * person wrote it down, not by an identifier nobody typed.
   */
  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly AssemblyLine[]>;

  /** Those a team runs, which is what its own configuration describes. */
  ofTeam(teamId: TeamId): Promise<readonly AssemblyLine[]>;

  /** The line a team runs for a given purpose, where it runs one. */
  withRole(teamId: TeamId, role: LineRole): Promise<AssemblyLine | null>;
}
