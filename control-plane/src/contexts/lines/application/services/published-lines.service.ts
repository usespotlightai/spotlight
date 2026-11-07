import type { LineView } from '@lines/application/contracts/line-view.contract';
import { LineViewMapper } from '@lines/application/mappers/line-view.mapper';
import type { LineCompilerPort } from '@lines/application/ports/line-compiler.port';
import type { LineRenderingPort } from '@lines/application/ports/line-rendering.port';
import type { LineResourcesPort } from '@lines/application/ports/line-resources.port';
import type {
  LinesPort,
  StationPreview,
  StationPreviewRequest,
} from '@lines/application/ports/lines.port';
import type { CatalogDenials } from '@lines/application/services/catalog-denials.service';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { reconcileLine } from '@lines/domain/services/reconcile-line';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const STATION = FieldPath.of(['station']);

const LINE = FieldPath.of(['line']);

const NO_TASK_COUNTS: ReadonlyMap<string, number> = new Map();

const refused = (at: FieldPath, reason: string): StationPreview => ({
  ok: false,
  problems: [ConfigurationProblem.of({ path: '', at, reason })],
});

const isBlock = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const rerooted =
  (place: number) =>
  (problem: ConfigurationProblem): ConfigurationProblem => {
    const [first, at, ...rest] = problem.field.segments;
    const moved = (to: FieldPath) =>
      ConfigurationProblem.of({
        path: problem.path,
        at: to,
        reason: problem.reason,
        severity: problem.severity,
      });

    if (first === 'stations' && at === place) {
      return moved(STATION.to(...rest));
    }
    if (first === 'repositories') {
      return moved(LINE.to(...problem.field.segments));
    }

    return problem;
  };

export class PublishedLines implements LinesPort {
  constructor(
    private readonly lines: LineRepository,
    private readonly resources: LineResourcesPort,
    private readonly compiler: LineCompilerPort,
    private readonly rendering: LineRenderingPort,
    private readonly catalog: CatalogDenials,
    private readonly ids: IdGeneratorPort,
  ) {}

  async find(lineId: string): Promise<LineView | null> {
    const line = await this.lines.find(LineId.of(lineId));

    return line ? LineViewMapper.of(line) : null;
  }

  async findByStation(stationId: string): Promise<LineView | null> {
    const line = await this.lines.findByStation(StationId.of(stationId));

    return line ? LineViewMapper.of(line) : null;
  }

  async ofTeam(teamId: string): Promise<readonly LineView[]> {
    return (await this.lines.ofTeam(TeamId.of(teamId))).map(LineViewMapper.of);
  }

  async ofWorkspace(workspaceId: string): Promise<readonly LineView[]> {
    return (await this.lines.ofWorkspace(WorkspaceId.of(workspaceId))).map(
      LineViewMapper.of,
    );
  }

  async preview(request: StationPreviewRequest): Promise<StationPreview> {
    const line = await this.lines.find(LineId.of(request.lineId));
    const record = line ? await this.resources.withId(request.lineId) : null;
    const place =
      record?.definition.stations.findIndex(
        (each) => each.key === request.stationKey,
      ) ?? -1;
    const station = line?.stations.find(
      (each) => each.key.value === request.stationKey,
    );

    if (!line || !record || !station || place < 0) {
      return refused(STATION, 'keeps the station on the line it is part of');
    }

    if (!isBlock(request.block)) {
      return refused(STATION, 'is a station block, as in a line');
    }

    if (request.block.key !== request.stationKey) {
      return refused(
        STATION.to('key'),
        `keeps the station’s key, ${request.stationKey}`,
      );
    }

    const compiled = this.compiler.compile({
      ...record.definition,
      ...(request.repositories === undefined
        ? {}
        : { repositories: request.repositories }),
      stations: record.definition.stations.map((each, at) =>
        at === place ? request.block : each,
      ),
    });

    if (!compiled.ok) {
      return { ok: false, problems: compiled.problems.map(rerooted(place)) };
    }

    const denied = await this.catalog.deniedIn(line.workspaceId, compiled.line);

    if (denied.length > 0) {
      return { ok: false, problems: denied.map(rerooted(place)) };
    }

    const candidate = reconcileLine({
      existing: line,
      plan: compiled.line,
      taskCounts: NO_TASK_COUNTS,
      newId: () => this.ids.generate(),
      by: ChangeActor.spotlight(line.workspaceId),
    });

    return candidate.stationAt(station.id)
      ? {
          ok: true,
          line: LineViewMapper.of(candidate),
          definition: this.rendering.definitionOf(candidate),
        }
      : refused(STATION, 'keeps the station on the line it is part of');
  }
}
