import {
  folderGuideAt,
  layoutAt,
} from '@memory/application/rendering/memory-folder-layout';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const PLAIN = { elsewhere: false };

const RUN_CONTEXT = {
  teamId: TeamId.of('team_1'),
  lineId: null,
  stationId: null,
  repositories: [],
};

describe('memory folder layout', () => {
  it('lays out a folder for each place a run works, and repositories only where it checked some out', () => {
    expect(layoutAt(RUN_CONTEXT, PLAIN).map((each) => each.level)).toEqual([
      'team',
    ]);
    expect(
      layoutAt(
        {
          ...RUN_CONTEXT,
          lineId: LineId.of('line_1'),
          stationId: StationId.of('station_1'),
          repositories: [Repository.of('acme/api')],
        },
        PLAIN,
      ).map((each) => each.level),
    ).toEqual(['team', 'line', 'station', 'repository']);
  });

  it('lays out what other stations learned about the same repositories only where there is some', () => {
    const elsewhere = { elsewhere: true };

    expect(
      layoutAt(
        { ...RUN_CONTEXT, repositories: [Repository.of('acme/api')] },
        elsewhere,
      ).map((each) => each.level),
    ).toEqual(['team', 'repository', 'elsewhere']);
    expect(layoutAt(RUN_CONTEXT, elsewhere).map((each) => each.level)).toEqual([
      'team',
    ]);
    expect(
      folderGuideAt(
        { ...RUN_CONTEXT, repositories: [Repository.of('acme/api')] },
        elsewhere,
      ),
    ).toContain(
      'elsewhere/<owner>/<name>/<path>/      learned at other stations about the same repositories; check it still fits here',
    );
  });

  it('tells where to look, and the repository folder only where the run checked some out', () => {
    const plain = folderGuideAt(RUN_CONTEXT, PLAIN);
    const checkedOut = folderGuideAt(
      {
        ...RUN_CONTEXT,
        repositories: [Repository.of('acme/api')],
      },
      PLAIN,
    );

    expect(plain).toContain('team/');
    expect(plain).toContain('the whole team');
    expect(plain).not.toContain('- change code you do not know');
    expect(plain).toContain('- choose between approaches');
    expect(checkedOut).toContain('repositories/<owner>/<name>/<path>/');
    expect(checkedOut).toContain(
      '- change code you do not know: the same path under `repositories/`',
    );
  });
});
