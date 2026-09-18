import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TraceAccess } from '@work/domain/services/trace-access';
import { describe, expect, it } from 'vitest';

describe('TraceAccess', () => {
  const one = TeamId.of('team_1');
  const two = TeamId.of('team_2');

  it('lets a run read a trace of its own team', () => {
    expect(TraceAccess.sameTeam(one, TeamId.of('team_1'))).toBe(true);
  });

  it('refuses a trace of another team', () => {
    expect(TraceAccess.sameTeam(one, two)).toBe(false);
  });

  it('refuses when either team is unknown', () => {
    expect(TraceAccess.sameTeam(one, null)).toBe(false);
    expect(TraceAccess.sameTeam(null, one)).toBe(false);
  });
});
