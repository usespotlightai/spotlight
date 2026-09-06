import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { WorkspaceFinding } from '@domain/repositories/workspace.repository';
import { BUILT_IN_LINES } from '@domain/services/built-in-lines';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

let opened: Factory | undefined;
let seeded: AssemblyLine[] = [];
let raised: Task | undefined;

const delivery = BUILT_IN_LINES[0];

const at = new Date('2026-09-03T09:00:00.000Z');

const provision = () =>
  new ProvisionFactory(
    {
      add: vi.fn(async (factory: Factory) => {
        opened = factory;
      }),
      ofTeam: vi.fn(async () => null),
    },
    {
      add: vi.fn(async (line: AssemblyLine) => {
        seeded.push(line);
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      holding: vi.fn(async () => null),
      ofWorkspace: vi.fn(async () => []),
      ofTeam: vi.fn(async () => []),
      withRole: vi.fn(async () => null),
    },
    ids(),
    {
      add: vi.fn(async (task: Task) => {
        raised = task;
      }),
    } as unknown as TaskRepository,
    { now: () => at, sleep: async () => {} },
    {
      find: vi.fn(async () =>
        Workspace.open({
          id: WorkspaceId.of('ws_1'),
          name: WorkspaceName.of('Acme'),
          slug: WorkspaceSlug.of('acme'),
          owner: UserId.of('user_1'),
          firstTeam: TeamId.of('team_1'),
        }),
      ),
    } satisfies WorkspaceFinding,
    HarnessId.of('claude-code'),
  ).onTeamCreated(
    new TeamCreated(
      WorkspaceId.of('ws_1'),
      TeamId.of('team_1'),
      UserId.of('user_1'),
    ),
  );

beforeEach(() => {
  opened = undefined;
  seeded = [];
  raised = undefined;
});

describe('ProvisionFactory', () => {
  it('opens a factory for the team that was created', async () => {
    await provision();

    expect(opened?.teamId).toEqual(TeamId.of('team_1'));
    expect(opened?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
  });

  it('opens every line a team starts with', async () => {
    await provision();

    expect(seeded.map((line) => line.key.value)).toEqual(
      BUILT_IN_LINES.map((line) => line.key.value),
    );
    for (const line of seeded) {
      expect(line.factoryId).toEqual(opened?.id);
    }
  });

  it('opens the delivery line with the stations it opens with', async () => {
    await provision();

    expect(seeded[0]?.stations.map((each) => each.name.value)).toEqual(
      delivery?.stations.map((each) => each.name.value),
    );
    expect(seeded[0]?.stations.map((each) => each.color.value)).toEqual(
      delivery?.stations.map((each) => each.color.value),
    );
  });

  // A team with a runner can begin the moment its lines are open: every
  // station where work is done is already worked by the default harness.
  it('opens every worked station on the default harness, and the rest on none', async () => {
    await provision();

    for (const line of seeded) {
      expect(
        line.worked.every((each) => each.harness?.value === 'claude-code'),
      ).toBe(true);
      expect(line.backlog.harness).toBeNull();
      expect(line.completed.harness).toBeNull();
    }
  });

  it('marks the improvement line by its role', async () => {
    await provision();

    const improvement = seeded.find((line) =>
      line.role?.equals(LineRole.IMPROVEMENT),
    );

    expect(improvement?.name.value).toBe('Factory Improvement');
  });

  // An inbox is one person's, and this is the person who opened the team.
  it('puts the welcome in the inbox of whoever opened it', async () => {
    await provision();

    expect(raised?.raisedBy).toEqual(UserId.of('user_1'));
    expect(raised?.title.value).toBe('Set up your team');
  });

  it('stands it at the first station of the delivery line', async () => {
    await provision();

    expect(raised?.stationId).toEqual(seeded[0]?.stations[0]?.id);
  });

  // An 'asked' with nothing after it is what an inbox item is made of.
  it('leaves it waiting on a person', async () => {
    await provision();

    expect(raised?.notes.map((each) => each.kind)).toEqual(['asked']);
  });

  // Each step is done somewhere, and the message links straight there.
  it('links each step to where it happens', async () => {
    await provision();

    const body = raised?.notes[0]?.body.value ?? '';

    expect(body).toContain('[Start a runner](/w/acme/runners)');
    expect(body).toContain(
      '[Install the GitHub App](/w/acme/team/team_1/integrations)',
    );
  });
});
