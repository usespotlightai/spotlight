import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { LinesNotOpenYetError } from '@work/application/errors/lines-not-open-yet.error';
import {
  type NewTeam,
  WelcomeTeam,
} from '@work/application/events/handlers/welcome-team.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  deliveryLineOf,
  reviewLineOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

const created: NewTeam = {
  teamId: TeamId.of('team_1'),
  owner: UserId.of('user_1'),
};

const LINES = [
  deliveryLineOf({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    newId: () => 'delivery',
  }),
  reviewLineOf({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    newId: () => 'review',
  }),
];

const welcoming = (
  over: { lines?: readonly LineMap[]; welcomed?: boolean } = {},
) => {
  const added: Task[] = [];
  const welcomed: TeamId[] = [];
  const welcomer = new WelcomeTeam(
    {
      ofTeam: vi.fn(async () => over.lines ?? LINES),
    } as unknown as LineMapsPort,
    {
      add: vi.fn(async (task: Task) => void added.push(task)),
    } as unknown as TaskRepository,
    {
      welcomed: vi.fn(async () => over.welcomed ?? false),
      record: vi.fn(async (teamId: TeamId) => void welcomed.push(teamId)),
      forget: vi.fn(),
    },
    ids(),
    { now: () => new Date('2026-09-03T09:00:00.000Z'), sleep: async () => {} },
  );

  return { welcomer, added, welcomed };
};

describe('WelcomeTeam', () => {
  it('welcomes whoever opened it at the first station of the delivery line, waiting on them', async () => {
    const { welcomer, added } = welcoming();

    await welcomer.welcome(created);

    expect(added[0]?.createdBy).toEqual(UserId.of('user_1'));
    expect(added[0]?.title.value).toBe('Set up your team');
    expect(added[0]?.stationId).toEqual(LINES[0]?.stations[0]?.id);
    expect(added[0]?.notes.map((each) => each.kind)).toEqual(['asked']);
    expect(added[0]?.notes[0]?.body.value).toContain('2. Connect a host.');
  });

  it('records that it welcomed the team, so the team reads as set up even after its setup task is gone', async () => {
    const { welcomer, welcomed } = welcoming();

    await welcomer.welcome(created);

    expect(welcomed).toEqual([TeamId.of('team_1')]);
  });

  it('welcomes a team only once', async () => {
    const { welcomer, added } = welcoming({ welcomed: true });

    await welcomer.welcome(created);

    expect(added).toHaveLength(0);
  });

  it('waits until the team’s delivery line is open', async () => {
    const { welcomer, added, welcomed } = welcoming({ lines: [] });

    await expect(welcomer.welcome(created)).rejects.toBeInstanceOf(
      LinesNotOpenYetError,
    );
    expect(added).toHaveLength(0);
    expect(welcomed).toHaveLength(0);
  });
});
