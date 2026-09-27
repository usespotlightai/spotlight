import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import {
  type MemoryPlace,
  MemoryScope,
} from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const place = (touched: string[] = []): MemoryPlace => ({
  teamId: TEAM,
  lineId: 'line_1',
  stationId: 'station_1',
  repositories: [API],
  touched: touched.map((path) => ({
    repository: API,
    path: MemoryPath.of(path),
  })),
});

const aboutPaths = (paths: string[]) =>
  MemoryScope.of({
    teamId: TEAM,
    repository: API,
    paths: paths.map(MemoryPath.of),
  });

describe('MemoryScope', () => {
  it('reaches a place through a folder that holds a touched file', () => {
    expect(
      aboutPaths(['src/uploads']).reaches(place(['src/uploads/retry.ts'])),
    ).toBe(true);
    expect(
      aboutPaths(['src/uploads/retry.ts']).reaches(
        place(['src/uploads/retry.ts']),
      ),
    ).toBe(true);
  });

  it('never reaches through a path that only begins the same way', () => {
    expect(
      aboutPaths(['src/uploads']).reaches(place(['src/uploadsX/a.ts'])),
    ).toBe(false);
  });

  it('never reaches a place that touched nothing it is about', () => {
    expect(aboutPaths(['src/uploads']).reaches(place())).toBe(false);
  });

  it('ranks paths, then a station, then a line, then a repository, then the team', () => {
    const specificity = [
      aboutPaths(['src']),
      MemoryScope.of({
        teamId: TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
      }),
      MemoryScope.of({ teamId: TEAM, lineId: 'line_1' }),
      MemoryScope.of({ teamId: TEAM, repository: API }),
      MemoryScope.of({ teamId: TEAM }),
    ].map((each) => each.specificity);

    expect(specificity).toEqual([4, 3, 2, 1, 0]);
  });
});
