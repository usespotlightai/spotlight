import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { TeamLayout } from '@memory/domain/services/team-layout';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const layout = TeamLayout.of({
  teamId: TeamId.of('team_1'),
  lines: [
    {
      id: 'line_delivery',
      stations: ['station_build'],
      repositories: [Repository.of('acme/api')],
    },
    {
      id: 'line_docs',
      stations: ['station_write'],
      repositories: [Repository.of('acme/docs')],
    },
  ],
});

describe('TeamLayout', () => {
  it('keeps a memory to the whole team when it names no line', () => {
    const scope = layout.scopeOf({});

    expect(scope.reach).toBe('team');
    expect(scope.teamId.value).toBe('team_1');
  });

  it('keeps a memory to a line, or a station of it', () => {
    expect(layout.scopeOf({ lineId: 'line_delivery' }).reach).toBe('line');
    expect(
      layout.scopeOf({ lineId: 'line_delivery', stationId: 'station_build' })
        .reach,
    ).toBe('station');
  });

  it('refuses a line of another team, or a station of another line', () => {
    expect(() => layout.scopeOf({ lineId: 'line_elsewhere' })).toThrow(
      InvalidMemoryError,
    );
    expect(() =>
      layout.scopeOf({ lineId: 'line_delivery', stationId: 'station_write' }),
    ).toThrow(InvalidMemoryError);
    expect(() => layout.scopeOf({ stationId: 'station_build' })).toThrow(
      InvalidMemoryError,
    );
  });

  it('names a repository its line works in, or any the team does when it names no line', () => {
    expect(
      layout.scopeOf({ repository: 'acme/docs', paths: ['guides/'] }).repository
        ?.value,
    ).toBe('acme/docs');
    expect(() =>
      layout.scopeOf({ lineId: 'line_delivery', repository: 'acme/docs' }),
    ).toThrow(InvalidMemoryError);
    expect(() => layout.scopeOf({ repository: 'not a repository' })).toThrow(
      InvalidMemoryError,
    );
  });

  it('refuses paths without the repository they lie in', () => {
    expect(() => layout.scopeOf({ paths: ['src/uploads.ts'] })).toThrow(
      InvalidMemoryError,
    );
  });
});
