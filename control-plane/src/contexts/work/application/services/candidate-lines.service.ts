import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { LineDefinitionStation } from '@work/application/contracts/line-definition.contract';
import type { LineCompilerPort } from '@work/application/ports/line-compiler.port';
import type {
  LineRecord,
  LineResourcesPort,
} from '@work/application/ports/line-resources.port';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import type { StationOrdering } from '@work/application/services/station-ordering';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { reconcileLine } from '@work/domain/services/reconcile-line';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';

const STATION = FieldPath.of(['station']);

const LINE = FieldPath.of(['line']);

const NO_TASK_COUNTS: ReadonlyMap<string, number> = new Map();

export interface StationInLine {
  readonly line: Line;
  readonly station: Station;
  readonly kept: LineRecord;
}

export type CandidateLine =
  | { readonly ok: true; readonly line: Line; readonly station: Station }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const problemAt = (
  path: string,
  at: FieldPath,
  reason: string,
): ConfigurationProblem => ConfigurationProblem.of({ path, at, reason });

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

export class CandidateLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly resources: LineResourcesPort,
    private readonly compiler: LineCompilerPort,
    private readonly catalog: StationCatalog,
    private readonly ordering: StationOrdering,
    private readonly ids: IdGeneratorPort,
  ) {}

  async live(lineId: string, stationId: string): Promise<StationInLine | null> {
    const line = await this.lines.find(LineId.of(lineId));
    const station = line?.stationAt(StationId.of(stationId));
    const kept = station ? await this.resources.withId(lineId) : null;

    return line && station && kept ? { line, station, kept } : null;
  }

  async keyed(lineId: string, key: string): Promise<StationInLine | null> {
    const line = await this.lines.find(LineId.of(lineId));
    const parsed = StationKey.parsed(key);
    const station = line && parsed ? line.stationKeyed(parsed) : null;
    const kept = station ? await this.resources.withId(lineId) : null;

    return line && station && kept ? { line, station, kept } : null;
  }

  liveBlockOf({ station, kept }: StationInLine): LineDefinitionStation | null {
    return (
      kept.definition.stations.find((each) => each.key === station.key.value) ??
      null
    );
  }

  async withStation(
    { line, station, kept }: StationInLine,
    block: unknown,
    repositories?: unknown,
  ): Promise<CandidateLine> {
    const place = kept.definition.stations.findIndex(
      (each) => each.key === station.key.value,
    );

    if (!isBlock(block)) {
      return {
        ok: false,
        problems: [problemAt('', STATION, 'is a station block, as in a line')],
      };
    }

    if (block.key !== station.key.value) {
      return {
        ok: false,
        problems: [
          problemAt(
            '',
            STATION.to('key'),
            `keeps the station’s key, ${station.key.value}`,
          ),
        ],
      };
    }

    const compiled = this.compiler.compile({
      ...kept.definition,
      ...(repositories === undefined ? {} : { repositories }),
      stations: kept.definition.stations.map((each, at) =>
        at === place ? block : each,
      ),
    });

    if (!compiled.ok) {
      return { ok: false, problems: compiled.problems.map(rerooted(place)) };
    }

    const refused = await this.catalog.refusedIn(
      line.workspaceId,
      compiled.line,
    );

    if (refused.length > 0) {
      return { ok: false, problems: refused.map(rerooted(place)) };
    }

    const reconciled = reconcileLine({
      existing: line,
      plan: compiled.line,
      taskCounts: NO_TASK_COUNTS,
      newId: () => this.ids.generate(),
      by: Attribution.spotlight(line.workspaceId),
    });
    const candidate = reconciled.ok
      ? reconciled.line.stationAt(station.id)
      : null;

    if (!reconciled.ok || !candidate) {
      return {
        ok: false,
        problems: [
          problemAt('', STATION, 'keeps the station on the line it is part of'),
        ],
      };
    }

    return { ok: true, line: reconciled.line, station: candidate };
  }

  async configOf(line: Line, station: Station): Promise<StationConfig | null> {
    const ordered = await this.ordering.ordered(line, {
      stationId: station.id,
      continuity: Continuity.of({
        key: ContinuityKey.forReplay(this.ids.generate()),
      }),
      checkouts: [],
    });
    return ordered ? this.ordering.configuredAs(ordered, line) : null;
  }
}
