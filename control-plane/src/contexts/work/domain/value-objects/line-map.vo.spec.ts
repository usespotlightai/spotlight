import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  deliveryLineOf,
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { describe, expect, it } from 'vitest';

const delivery = (harness: HarnessId | null = HarnessId.of('claude-code')) => {
  let next = 0;
  return deliveryLineOf({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    newId: () => `id_${++next}`,
    harness,
  });
};

const keyed = (line: LineMap, key: string) =>
  line.stations.find((each) => each.key.value === key) as Station;

const at = (
  position: number,
  over: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id: StationId.of(`station_${position}`),
    key: StationKey.of(`station-${position}`),
    name: StationName.of(`Station ${position}`),
    position,
    ...over,
  });

const placed = (
  over: { repositories?: Parameters<typeof lineMapOf>[0]['repositories'] } = {},
) =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      at(0, { kind: 'backlog' }),
      at(1),
      at(2, { placement: RunnerPlacement.of(['gpu']) }),
      at(3, { kind: 'completed' }),
    ],
    placement: RunnerPlacement.of(['vpc-internal']),
    ...over,
  });

const COMMENTED = Happening.of('github.pull_request.commented');

const reacting = (reactions: readonly Reaction[]) =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      at(0, { kind: 'backlog' }),
      at(1),
      at(2),
      at(3, { kind: 'completed' }),
    ],
    reactions,
  });

const sends = (to: string, from?: string) =>
  Reaction.of({
    happening: COMMENTED,
    from: from ? StationId.of(from) : null,
    to: StationId.of(to),
  });

describe('LineMap, where work runs', () => {
  it('places a station’s work where the station says, or else where its line does', () => {
    const line = placed();

    expect(line.placementOf(StationId.of('station_1')).requiredLabels).toEqual([
      'vpc-internal',
    ]);
    expect(line.placementOf(StationId.of('station_2')).requiredLabels).toEqual([
      'gpu',
    ]);
  });

  it('places every station’s work, and the line’s own, in the image its repositories name', () => {
    const image = RunnerImage.of('ghcr.io/acme/api:1');
    const line = placed({
      repositories: [
        repositoryOf(Repository.of('acme/api'), { image }),
        repositoryOf(Repository.of('acme/web')),
      ],
    });

    expect(line.image?.equals(image)).toBe(true);
    expect(line.placementOf(StationId.of('station_1')).image).toBe(image);
    expect(line.placementOf(StationId.of('station_2')).image).toBe(image);
    expect(line.runsIn.image).toBe(image);
    expect(line.runsIn.requiredLabels).toEqual(['vpc-internal']);
  });

  it('places its work in no image when its repositories name none', () => {
    const line = placed({
      repositories: [repositoryOf(Repository.of('acme/api'))],
    });

    expect(line.placementOf(StationId.of('station_1')).image).toBeNull();
  });

  it('says the harness it runs on is its first work station’s', () => {
    expect(delivery().harness?.value).toBe('claude-code');
    expect(delivery().entry?.key.value).toBe('triage');
    expect(delivery(null).harness).toBeNull();
  });

  it('knows its backlog and its completed station', () => {
    const line = delivery();

    expect(line.backlog.key.value).toBe('backlog');
    expect(line.completed.key.value).toBe('completed');
  });
});

describe('LineMap, how far downstream a station is', () => {
  const depth = (line: LineMap, key: string) =>
    line.depthOf(keyed(line, key).id);

  it('is the shortest distance from the backlog along the flow', () => {
    const line = delivery();

    expect(depth(line, 'backlog')).toBe(0);
    expect(depth(line, 'triage')).toBe(1);
    expect(depth(line, 'spec')).toBe(2);
    expect(depth(line, 'code-review')).toBe(3);
  });

  it('puts a fork’s branches at the same depth, without counting rework that loops back', () => {
    const line = delivery();

    expect(depth(line, 'implementation')).toBe(depth(line, 'spec'));
    expect(depth(line, 'implementation')).toBe(2);
  });

  it('puts what finishes the line last of all', () => {
    const line = delivery();
    const furthest = Math.max(
      ...line.stations
        .filter((each) => each.isAgentStation)
        .map((each) => line.depthOf(each.id)),
    );

    expect(depth(line, 'completed')).toBeGreaterThan(furthest);
  });
});

describe('LineMap, what it waits for from outside', () => {
  it('sends a happening to the station set to wait for it, and nobody’s nowhere', () => {
    const line = delivery();
    const somewhere = keyed(line, 'triage').id;
    const named = (reaction: Reaction | null) =>
      reaction ? line.stationAt(reaction.to)?.key.value : null;

    expect(
      named(
        line.reactionTo(Happening.of('github.pull_request.merged'), somewhere),
      ),
    ).toBe('completed');
    expect(named(line.reactionTo(COMMENTED, somewhere))).toBe('code-review');
    expect(
      line.reactionTo(
        Happening.of('github.pull_request.closed-unmerged'),
        somewhere,
      ),
    ).toBeNull();
  });

  it('prefers a rule that names where the task is', () => {
    const line = reacting([
      sends('station_1'),
      sends('station_2', 'station_1'),
    ]);

    expect(line.reactionTo(COMMENTED, StationId.of('station_1'))?.to).toEqual(
      StationId.of('station_2'),
    );
    expect(line.reactionTo(COMMENTED, StationId.of('station_2'))?.to).toEqual(
      StationId.of('station_1'),
    );
  });
});

describe('LineMap, where work may be passed on to', () => {
  it('lets work pass along a route to a station something runs at', () => {
    const line = delivery();

    expect(
      line.passDenial(keyed(line, 'triage').id, keyed(line, 'spec')),
    ).toBeNull();
  });

  it('denies passing work back to where it already is', () => {
    const line = delivery();

    expect(
      line.passDenial(keyed(line, 'triage').id, keyed(line, 'triage')),
    ).toBe('already-there');
  });

  it('denies passing work to a station nothing runs at', () => {
    const line = delivery(null);

    expect(line.passDenial(keyed(line, 'triage').id, keyed(line, 'spec'))).toBe(
      'nothing-runs',
    );
  });

  it('denies passing work where no route leads', () => {
    const line = delivery();

    expect(
      line.passDenial(keyed(line, 'triage').id, keyed(line, 'code-review')),
    ).toBe('no-route');
  });

  it('lets a person start work from the backlog, park it back there, or close it from anywhere', () => {
    const line = delivery();
    const moves = [
      ['backlog', 'spec'],
      ['backlog', 'completed'],
      ['implementation', 'backlog'],
      ['code-review', 'completed'],
      ['triage', 'triage'],
      ['completed', 'completed'],
    ] as const;

    expect(
      moves.map(([from, to]) =>
        line.moveDenial(keyed(line, from), keyed(line, to)),
      ),
    ).toEqual([null, null, null, null, null, null]);
  });

  it('denies a person moving work between work stations, or out of completed', () => {
    const line = delivery();

    expect(line.moveDenial(keyed(line, 'triage'), keyed(line, 'spec'))).toBe(
      'between-work-stations',
    );
    expect(
      line.moveDenial(keyed(line, 'completed'), keyed(line, 'backlog')),
    ).toBe('out-of-completed');
  });

  it('offers the stations work passes to, then a person, and finishing where the line ends', () => {
    const line = delivery();

    expect(
      line.optionsFrom(keyed(line, 'triage').id).map((each) => each.word),
    ).toEqual(['spec', 'implementation', 'review']);
    expect(
      line.optionsFrom(keyed(line, 'code-review').id).map((each) => each.word),
    ).toEqual(['spec', 'implementation', 'review', 'done']);
    expect(
      line
        .optionsFrom(StationId.of('station_missing'))
        .map((each) => each.word),
    ).toEqual(['review']);
  });

  it('says whether the line ends at a station', () => {
    const line = delivery();

    expect(line.endsAt(keyed(line, 'code-review').id)).toBe(true);
    expect(line.endsAt(keyed(line, 'triage').id)).toBe(false);
    expect(line.endsAt(StationId.of('station_missing'))).toBe(false);
  });
});
