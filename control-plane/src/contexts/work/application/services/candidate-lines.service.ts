import type { LineDefinitionStation } from '@lines/application/contracts/line-definition.contract';
import type {
  LineRecord,
  LineResourcesPort,
} from '@lines/application/ports/line-resources.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { StationOrdering } from '@work/application/services/station-ordering';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

export interface StationInLine {
  readonly line: LineMap;
  readonly station: Station;
  readonly record: LineRecord;
}

export type CandidateLine =
  | {
      readonly ok: true;
      readonly line: LineMap;
      readonly station: Station;
      readonly definition: LineDefinitionStation;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export class CandidateLines {
  constructor(
    private readonly lines: LineMapsPort,
    private readonly resources: LineResourcesPort,
    private readonly ordering: StationOrdering,
    private readonly ids: IdGeneratorPort,
  ) {}

  async live(lineId: string, stationId: string): Promise<StationInLine | null> {
    const line = await this.lines.find(LineId.of(lineId));
    const station = line?.stationAt(StationId.of(stationId));
    const record = station ? await this.resources.withId(lineId) : null;

    return line && station && record ? { line, station, record } : null;
  }

  async withStationId(stationId: string): Promise<StationInLine | null> {
    const id = StationId.of(stationId);
    const line = await this.lines.findByStation(id);
    const station = line?.stationAt(id);
    const record =
      line && station ? await this.resources.withId(line.id.value) : null;

    return line && station && record ? { line, station, record } : null;
  }

  async keyed(lineId: string, key: string): Promise<StationInLine | null> {
    const line = await this.lines.find(LineId.of(lineId));
    const parsed = StationKey.parsed(key);
    const station = line && parsed ? line.stationKeyed(parsed) : null;
    const record = station ? await this.resources.withId(lineId) : null;

    return line && station && record ? { line, station, record } : null;
  }

  liveBlockOf({
    station,
    record,
  }: StationInLine): LineDefinitionStation | null {
    return (
      record.definition.stations.find(
        (each) => each.key === station.key.value,
      ) ?? null
    );
  }

  async withStation(
    { line, station }: StationInLine,
    block: unknown,
    repositories?: unknown,
  ): Promise<CandidateLine> {
    const candidate = await this.lines.candidate({
      lineId: line.id,
      stationKey: station.key.value,
      block,
      ...(repositories === undefined ? {} : { repositories }),
    });

    if (!candidate.ok) {
      return candidate;
    }

    const changed = candidate.line.stationAt(station.id);
    const definition = candidate.definition.stations.find(
      (each) => each.key === station.key.value,
    );

    return changed && definition
      ? { ok: true, line: candidate.line, station: changed, definition }
      : {
          ok: false,
          problems: [
            ConfigurationProblem.of({
              path: '',
              at: FieldPath.of(['station']),
              reason: 'keeps the station on the line it is part of',
            }),
          ],
        };
  }

  async configOf(
    line: LineMap,
    station: Station,
  ): Promise<StationConfig | null> {
    const ordered = await this.ordering.ordered(line, {
      stationId: station.id,
      resume: Resume.of({
        key: ResumeKey.forReplay(RunId.of(this.ids.generate())),
      }),
      checkouts: [],
    });
    return ordered ? this.ordering.configuredAs(ordered, line) : null;
  }
}
