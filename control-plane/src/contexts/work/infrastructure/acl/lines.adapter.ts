import type { LinesPort } from '@lines/application/ports/lines.port';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  LineMapsPort,
  StationCandidate,
  StationCandidateRequest,
} from '@work/application/ports/line-maps.port';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { lineMapOf } from '@work/infrastructure/acl/line-map.translation';

export class LinesLineMaps implements LineMapsPort {
  constructor(private readonly lines: LinesPort) {}

  async find(id: LineId): Promise<LineMap | null> {
    const view = await this.lines.find(id.value);

    return view ? lineMapOf(view) : null;
  }

  async findByStation(stationId: StationId): Promise<LineMap | null> {
    const view = await this.lines.findByStation(stationId.value);

    return view ? lineMapOf(view) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly LineMap[]> {
    return (await this.lines.ofTeam(teamId.value)).map(lineMapOf);
  }

  async ofWorkspace(workspaceId: WorkspaceId): Promise<readonly LineMap[]> {
    return (await this.lines.ofWorkspace(workspaceId.value)).map(lineMapOf);
  }

  async candidate(request: StationCandidateRequest): Promise<StationCandidate> {
    const preview = await this.lines.preview({
      lineId: request.lineId.value,
      stationKey: request.stationKey,
      block: request.block,
      ...(request.repositories === undefined
        ? {}
        : { repositories: request.repositories }),
    });

    return preview.ok
      ? {
          ok: true,
          line: lineMapOf(preview.line),
          definition: preview.definition,
        }
      : { ok: false, problems: preview.problems };
  }
}
