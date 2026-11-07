import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { StationOrdering } from '@work/application/services/station-ordering';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { StationConfig } from '@work/domain/value-objects/station-config.vo';

export interface StationInLine {
  readonly line: LineMap;
  readonly station: Station;
}

export type CandidateLine =
  | {
      readonly ok: true;
      readonly line: LineMap;
      readonly station: Station;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export class CandidateLines {
  constructor(
    private readonly lines: LineMapsPort,
    private readonly ordering: StationOrdering,
  ) {}

  async live(lineId: string, stationId: string): Promise<StationInLine | null> {
    const line = await this.lines.find(LineId.of(lineId));
    const station = line?.stationAt(StationId.of(stationId));

    return line && station ? { line, station } : null;
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

    return changed
      ? { ok: true, line: candidate.line, station: changed }
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
      resume: Resume.of({}),
      checkouts: [],
    });
    return ordered ? this.ordering.configuredAs(ordered, line) : null;
  }
}
