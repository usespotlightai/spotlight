import type { LinesPort } from '@replays/application/ports/lines.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  ReplayRunLabelsReaderPort,
  ReplayRunRow,
} from '@replays/application/ports/replay-run-labels-reader.port';
import { replayRunTitle } from '@replays/application/rendering/replay-run-title';
import { TeamAccess } from '@replays/application/services/team-access';
import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface ReplayRunLabel {
  readonly run: RunId;
  readonly title: string;
  readonly station: ReplayedStation | null;
}

const distinctBy = <Item>(
  items: readonly Item[],
  keyOf: (item: Item) => string,
): readonly Item[] => [
  ...new Map(items.map((each) => [keyOf(each), each])).values(),
];

const stationKeyOf = (station: ReplayedStation): string =>
  `${station.lineId.value}:${station.stationId.value}`;

export class ReplayRunLabels {
  constructor(
    private readonly reader: ReplayRunLabelsReaderPort,
    private readonly people: PeoplePort,
    private readonly lines: LinesPort,
  ) {}

  /** Labels the replay runs among `runs` that the viewer may see: those of the teams the viewer is on. */
  async of(
    runs: readonly RunId[],
    viewer: UserId,
  ): Promise<readonly ReplayRunLabel[]> {
    const rows = await this.reader.replayRuns(runs);
    const seen = await this.seenBy(rows, viewer);
    const names = new Map(
      await Promise.all(
        distinctBy(
          seen.map((each) => each.station),
          stationKeyOf,
        ).map(
          async (station) =>
            [
              stationKeyOf(station),
              (await this.lines.station(station.lineId, station.stationId))
                ?.name ?? null,
            ] as const,
        ),
      ),
    );

    return seen.map((row) => {
      const name = names.get(stationKeyOf(row.station)) ?? null;

      return {
        run: row.run,
        title: replayRunTitle(
          { name: row.candidateName, kind: row.candidateKind },
          name,
        ),
        station: name === null ? null : row.station,
      };
    });
  }

  private async seenBy(
    rows: readonly ReplayRunRow[],
    viewer: UserId,
  ): Promise<readonly ReplayRunRow[]> {
    const principal = PersonPrincipal.of(viewer);
    const accesses = await Promise.all(
      distinctBy(
        rows.map((each) => each.station.teamId),
        (team) => team.value,
      ).map(async (team) => {
        const membership = await this.people.membershipOn(team, principal);

        return membership ? TeamAccess.onTeam(team.value, membership) : null;
      }),
    );

    return rows.filter((row) =>
      accesses.some((access) => access?.sees(row.station) ?? false),
    );
  }
}
