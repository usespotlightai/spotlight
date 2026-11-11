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
  type RepositorySpec,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { WarmFingerprint } from '@work/domain/value-objects/warm-fingerprint.vo';
import { describe, expect, it } from 'vitest';

const lineOf = (
  repositories: readonly RepositorySpec[],
  placement: RunnerPlacement = RunnerPlacement.anywhere(),
): LineMap =>
  LineMap.of({
    id: LineId.of('line_1'),
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
      repositories,
      repositories.find((each) => each.image)?.image ?? null,
    ),
    placement,
  });

const API = repositoryOf(Repository.of('acme/api'));
const WIDGETS = repositoryOf(Repository.of('acme/widgets'), {
  setup: 'npm ci',
});

const fingerprintOf = (
  repositories: readonly RepositorySpec[],
  placement?: RunnerPlacement,
) => WarmFingerprint.ofLine(lineOf(repositories, placement));

describe('WarmFingerprint', () => {
  it('is the same whatever order the line lists its repositories and labels in', () => {
    expect(
      fingerprintOf(
        [WIDGETS, API],
        RunnerPlacement.ofLabelGroups([['gpu', 'linux'], ['eu']]),
      ).equals(
        fingerprintOf(
          [API, WIDGETS],
          RunnerPlacement.ofLabelGroups([['eu'], ['linux', 'gpu']]),
        ),
      ),
    ).toBe(true);
  });

  it('is the same for a setup with blanks around it', () => {
    expect(
      fingerprintOf([
        repositoryOf(Repository.of('acme/widgets'), { setup: ' npm ci ' }),
      ]).equals(fingerprintOf([WIDGETS])),
    ).toBe(true);
  });

  it('changes with a repository, a setup, the labels or the image', () => {
    const base = fingerprintOf([WIDGETS]);

    expect(fingerprintOf([WIDGETS, API]).equals(base)).toBe(false);
    expect(
      fingerprintOf([repositoryOf(Repository.of('acme/widgets'))]).equals(base),
    ).toBe(false);
    expect(
      fingerprintOf([WIDGETS], RunnerPlacement.of(['gpu'])).equals(base),
    ).toBe(false);
    expect(
      fingerprintOf([
        repositoryOf(Repository.of('acme/widgets'), {
          setup: 'npm ci',
          image: RunnerImage.of('ghcr.io/acme/node:22'),
        }),
      ]).equals(base),
    ).toBe(false);
  });

  it('reads back from its value', () => {
    const fingerprint = fingerprintOf([WIDGETS]);

    expect(WarmFingerprint.of(fingerprint.value).equals(fingerprint)).toBe(
      true,
    );
  });
});
