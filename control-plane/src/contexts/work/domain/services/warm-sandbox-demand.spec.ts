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
  type KeptWarmSandbox,
  WarmSandboxDemands,
  warmCheckoutsOf,
} from '@work/domain/services/warm-sandbox-demand';
import {
  type RepositorySpec,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { WarmSandboxQuota } from '@work/domain/value-objects/warm-sandbox-quota.vo';
import { WarmShape } from '@work/domain/value-objects/warm-shape.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-08T12:00:00.000Z');

const WIDGETS = repositoryOf(Repository.of('acme/widgets'), {
  setup: 'npm ci',
});

const lineOf = (
  input: {
    id?: string;
    warm?: number;
    repositories?: readonly RepositorySpec[];
    placement?: RunnerPlacement;
  } = {},
): LineMap =>
  LineMap.of({
    id: LineId.of(input.id ?? 'line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of('backlog'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        kind: 'completed',
      }),
    ],
    repositories: LineRepositories.of(
      input.repositories ?? [WIDGETS],
      input.repositories?.find((each) => each.image)?.image ?? null,
    ),
    placement: input.placement,
    warmSandboxes: WarmSandboxQuota.of(input.warm ?? 1),
  });

const keptOf = (
  id: string,
  line: LineMap,
  shape = WarmShape.ofLine(line),
): KeptWarmSandbox => ({ id, lineId: line.id, shape });

const demandOf = (
  lines: readonly LineMap[],
  kept: readonly KeptWarmSandbox[] = [],
  lostRecently: readonly LineId[] = [],
) => WarmSandboxDemands.of({ lines, kept, lostRecently });

describe('WarmSandboxDemands', () => {
  it('requests the warm sandboxes a line is missing, with the line’s current shape', () => {
    const line = lineOf({ warm: 3 });

    const demand = demandOf([line], [keptOf('sandbox_1', line)]);

    expect(demand.retired).toEqual([]);
    expect(demand.requested).toEqual([
      { line, shape: WarmShape.ofLine(line) },
      { line, shape: WarmShape.ofLine(line) },
    ]);
  });

  it('keeps a line’s warm sandboxes as they are when it has as many as it asks for', () => {
    const line = lineOf({ warm: 2 });

    expect(
      demandOf([line], [keptOf('sandbox_1', line), keptOf('sandbox_2', line)]),
    ).toEqual({ requested: [], retired: [] });
  });

  it('retires the extra warm sandboxes, keeping the oldest', () => {
    const line = lineOf({ warm: 1 });

    expect(
      demandOf([line], [keptOf('sandbox_1', line), keptOf('sandbox_2', line)])
        .retired,
    ).toEqual(['sandbox_2']);
  });

  it('replaces a warm sandbox whose line changed its repositories, setups, image or placement', () => {
    const line = lineOf();
    const before = WarmShape.ofLine(
      lineOf({ repositories: [repositoryOf(Repository.of('acme/widgets'))] }),
    );

    expect(demandOf([line], [keptOf('sandbox_1', line, before)])).toEqual({
      requested: [{ line, shape: WarmShape.ofLine(line) }],
      retired: ['sandbox_1'],
    });
    expect(
      WarmShape.ofLine(
        lineOf({ placement: RunnerPlacement.of(['gpu']) }),
      ).equals(WarmShape.ofLine(line)),
    ).toBe(false);
    expect(
      WarmShape.ofLine(
        lineOf({
          repositories: [
            repositoryOf(Repository.of('acme/widgets'), {
              setup: 'npm ci',
              image: RunnerImage.of('ghcr.io/acme/node:22'),
            }),
          ],
        }),
      ).equals(WarmShape.ofLine(line)),
    ).toBe(false);
  });

  it('retires every warm sandbox of a line that asks for none or is gone', () => {
    const none = lineOf({ id: 'line_1', warm: 0 });
    const gone = lineOf({ id: 'line_2' });

    expect(
      demandOf([none], [keptOf('sandbox_1', none), keptOf('sandbox_2', gone)]),
    ).toEqual({ requested: [], retired: ['sandbox_1', 'sandbox_2'] });
  });

  it('requests none for a line that lost a warm sandbox unadopted within the back-off', () => {
    const line = lineOf({ warm: 2 });

    expect(demandOf([line], [], [line.id]).requested).toEqual([]);
    expect(WarmSandboxDemands.lostAfter(NOW)).toEqual(
      new Date(NOW.getTime() - 15 * 60_000),
    );
  });

  it('keeps none for a line with no repositories, or two repositories of one name', () => {
    expect(demandOf([lineOf({ repositories: [] })]).requested).toEqual([]);
    expect(
      demandOf([
        lineOf({
          repositories: [WIDGETS, repositoryOf(Repository.of('other/widgets'))],
        }),
      ]).requested,
    ).toEqual([]);
  });

  it('checks out each repository of the line under its name, with its setup', () => {
    expect(
      warmCheckoutsOf(
        lineOf({
          repositories: [WIDGETS, repositoryOf(Repository.of('acme/api'))],
        }),
      ),
    ).toEqual([
      { path: 'widgets', setup: 'npm ci' },
      { path: 'api', setup: null },
    ]);
  });
});
