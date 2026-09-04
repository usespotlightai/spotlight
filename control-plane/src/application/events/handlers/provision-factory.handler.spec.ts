import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { BUILT_IN_STATIONS } from '@domain/services/built-in-stations';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

let opened: Factory | undefined;
let seeded: AssemblyLine | undefined;
let raised: Task | undefined;

const at = new Date('2026-09-03T09:00:00.000Z');

const provision = () =>
  new ProvisionFactory(
    {
      add: vi.fn(async (factory: Factory) => {
        opened = factory;
      }),
    },
    {
      add: vi.fn(async (line: AssemblyLine) => {
        seeded = line;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      holding: vi.fn(async () => null),
      ofWorkspace: vi.fn(async () => []),
      ofTeam: vi.fn(async () => []),
    },
    ids(),
    {
      add: vi.fn(async (task: Task) => {
        raised = task;
      }),
    } as unknown as TaskRepository,
    { now: () => at, sleep: async () => {} },
  ).onTeamCreated(
    new TeamCreated(
      WorkspaceId.of('ws_1'),
      TeamId.of('team_1'),
      UserId.of('user_1'),
    ),
    WorkspaceSlug.of('acme'),
  );

beforeEach(() => {
  opened = undefined;
  seeded = undefined;
  raised = undefined;
});

describe('ProvisionFactory', () => {
  it('opens a factory for the team that was created', async () => {
    await provision();

    expect(opened?.teamId).toEqual(TeamId.of('team_1'));
    expect(opened?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
  });

  it('opens the line every line opens with', async () => {
    await provision();

    expect(seeded?.factoryId).toEqual(opened?.id);
    expect(seeded?.stations.map((each) => each.name.value)).toEqual(
      BUILT_IN_STATIONS.map((each) => each.name.value),
    );
    expect(seeded?.stations.map((each) => each.color.value)).toEqual(
      BUILT_IN_STATIONS.map((each) => each.color.value),
    );
  });

  // An inbox is one person's, and this is the person who opened the team.
  it('puts the welcome in the inbox of whoever opened it', async () => {
    await provision();

    expect(raised?.raisedBy).toEqual(UserId.of('user_1'));
    expect(raised?.title.value).toBe('Set up your team');
  });

  it('stands it at the first station of the line it opened', async () => {
    await provision();

    expect(raised?.stationId).toEqual(seeded?.stations[0]?.id);
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
