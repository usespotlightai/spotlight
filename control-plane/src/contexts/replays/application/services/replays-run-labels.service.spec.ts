import { ReplaysRunLabels } from '@replays/application/services/replays-run-labels.service';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const requester = (
  kind: string,
  id: string,
  team: string | null = 'team_1',
) => ({
  owner: 'replays',
  kind,
  id,
  token: kind === 'search' ? '1' : null,
  team,
});

const membersOf = (team: string) => ({
  of: 'team-members',
  teamId: TeamId.of(team),
});

describe('ReplaysRunLabels', () => {
  it('names a replay run and a search run, for the members of the team of each', async () => {
    const found = await new ReplaysRunLabels().labelsOf([
      requester('replay', 'run_1'),
      requester('search', 'search_1', 'team_2'),
    ]);

    expect(found.get('replays/replay/run_1')).toEqual({
      title: 'A replay run',
      readers: membersOf('team_1'),
    });
    expect(found.get('replays/search/search_1')).toEqual({
      title: 'A search run',
      readers: membersOf('team_2'),
    });
  });

  it('names no run without a team, and no requester it cannot read', async () => {
    const found = await new ReplaysRunLabels().labelsOf([
      requester('replay', 'run_nowhere', null),
      { ...requester('search', 'search_1'), token: null },
      requester('other', 'x'),
    ]);

    expect(found.size).toBe(0);
  });
});
