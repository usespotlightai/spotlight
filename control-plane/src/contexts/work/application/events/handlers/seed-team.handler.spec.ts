import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type NewTeam,
  SeedTeam,
} from '@work/application/events/handlers/seed-team.handler';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

const created: NewTeam = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  owner: UserId.of('user_1'),
};

const seeding = (over: { existing?: Line[]; setup?: boolean } = {}) => {
  const seeded: Line[] = [...(over.existing ?? [])];
  const added: Task[] = [];
  const seeder = new SeedTeam(
    {
      add: vi.fn(async (line: Line) => void seeded.push(line)),
      ofTeam: vi.fn(async () => [...seeded]),
    } as unknown as LineRepository,
    {
      add: vi.fn(async (task: Task) => void added.push(task)),
      settingUpFor: vi.fn(async () => (over.setup ? {} : null)),
    } as unknown as TaskRepository,
    ids(),
    { now: () => new Date('2026-09-03T09:00:00.000Z'), sleep: async () => {} },
    HarnessId.of('claude-code'),
  );

  return { seeder, seeded, added };
};

describe('SeedTeam', () => {
  it('opens every line a team starts with, for that team', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);

    expect(seeded.map((line) => line.key.value)).toEqual(
      BUILT_IN_LINES.map((line) => line.key.value),
    );
    expect(seeded.every((line) => line.teamId.equals(created.teamId))).toBe(
      true,
    );
  });

  it('opens no line twice when told again', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);
    await seeder.seed(created);

    expect(seeded).toHaveLength(BUILT_IN_LINES.length);
  });

  it('opens every worked station on the default harness, and the rest on none', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);

    for (const line of seeded) {
      expect(
        line.agentStations.every(
          (each) => each.harness?.value === 'claude-code',
        ),
      ).toBe(true);
      expect(line.backlog.harness).toBeNull();
      expect(line.completed.harness).toBeNull();
    }
  });

  it('opens the delivery and review lines and nothing else', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);

    expect(seeded.map((line) => line.key.value)).toEqual([
      'delivery',
      'review',
    ]);
  });

  it('opens a review line that waits to be mentioned on a pull request', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);

    const review = seeded.find((line) => line.role?.equals(LineRole.REVIEW));

    expect(review?.name.value).toBe('Review');
    expect(review?.reviews?.start).toBe('mentioned');
    expect(review?.entry?.key.value).toBe('code-review');
    expect(review?.entry?.harness?.value).toBe('claude-code');
  });

  it('welcomes whoever opened it at the first station of the delivery line, waiting on them', async () => {
    const { seeder, seeded, added } = seeding();

    await seeder.seed(created);

    expect(added[0]?.createdBy).toEqual(UserId.of('user_1'));
    expect(added[0]?.title.value).toBe('Set up your team');
    expect(added[0]?.stationId).toEqual(seeded[0]?.stations[0]?.id);
    expect(added[0]?.notes.map((each) => each.kind)).toEqual(['asked']);
    expect(added[0]?.notes[0]?.body.value).toContain('2. Connect a host.');
  });

  it('welcomes a team only once', async () => {
    const { seeder, added } = seeding({ setup: true });

    await seeder.seed(created);

    expect(added).toHaveLength(0);
  });
});
