import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import {
  chatPlacement,
  chatSetupOf,
} from '@work/domain/services/chat-placement';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { describe, expect, it } from 'vitest';

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');
const DOCS = Repository.of('acme/docs');

const line = (
  key: string,
  repositories: readonly (Repository | WorkedRepository)[],
  runners: string[],
) =>
  Line.rehydrate({
    id: LineId.of(key),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of(key),
    name: LineName.of(key),
    repositories: repositories.map((each) =>
      each instanceof WorkedRepository ? each : WorkedRepository.of(each),
    ),
    placement: RunnerPlacement.of(runners),
    stations: [
      Station.of({
        id: StationId.of(`${key}-backlog`),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.plain(),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of(`${key}-completed`),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.plain(),
        kind: 'completed',
      }),
    ],
  });

const LINES = [
  line('api', [API], ['vpc-internal']),
  line('web', [WEB], ['build-1', 'vpc-internal']),
  line('docs', [DOCS], []),
];

describe('chatPlacement', () => {
  it('places a chat where every line working in one of its repositories would run', () => {
    const placed = chatPlacement([API, WEB], LINES);

    expect(placed?.admits(RunnerTerms.of(['vpc-internal']))).toBe(true);
    expect(placed?.admits(RunnerTerms.of(['build-1']))).toBe(false);
  });

  it('places a chat anywhere when its repositories are worked only by lines placed anywhere, or by none', () => {
    expect(chatPlacement([DOCS], LINES)?.isAnywhere).toBe(true);
    expect(
      chatPlacement([Repository.of('acme/other')], LINES)?.isAnywhere,
    ).toBe(true);
    expect(chatPlacement([], LINES)?.isAnywhere).toBe(true);
  });

  it('places a chat in the image the lines working in its repositories run in', () => {
    const image = RunnerImage.of('ghcr.io/acme/api:1');
    const placed = chatPlacement(
      [API],
      [line('api', [WorkedRepository.of(API, { image })], ['vpc-internal'])],
    );

    expect(placed?.image?.equals(image)).toBe(true);
    expect(placed?.selectors).toEqual(['vpc-internal']);
  });

  it('places no chat whose repositories are worked in two images', () => {
    const lines = [
      line(
        'api',
        [
          WorkedRepository.of(API, {
            image: RunnerImage.of('ghcr.io/acme/api:1'),
          }),
        ],
        [],
      ),
      line(
        'web',
        [
          WorkedRepository.of(WEB, {
            image: RunnerImage.of('ghcr.io/acme/web:1'),
          }),
        ],
        [],
      ),
    ];

    expect(chatPlacement([API, WEB], lines)).toBeNull();
    expect(chatPlacement([API], lines)?.image?.value).toBe(
      'ghcr.io/acme/api:1',
    );
  });
});

describe('chatSetupOf', () => {
  it('makes a chat’s checkout ready as a line working that repository says', () => {
    const lines = [
      line('web', [WEB], []),
      line(
        'api',
        [WorkedRepository.of(API, { setup: RepositorySetup.of('npm ci') })],
        [],
      ),
    ];

    expect(chatSetupOf(API, lines)?.value).toBe('npm ci');
    expect(chatSetupOf(WEB, lines)).toBeNull();
    expect(chatSetupOf(DOCS, lines)).toBeNull();
  });
});
