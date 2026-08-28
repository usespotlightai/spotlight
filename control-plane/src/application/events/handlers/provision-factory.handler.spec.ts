import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import { DEFAULT_TEMPLATE } from '@domain/value-objects/built-in-templates';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

let opened: Factory | undefined;
let seeded: AssemblyLine | undefined;

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
    },
    ids(),
  ).onTeamCreated(new TeamCreated(WorkspaceId.of('ws_1'), TeamId.of('team_1')));

beforeEach(() => {
  opened = undefined;
  seeded = undefined;
});

describe('ProvisionFactory', () => {
  it('opens a factory for the team that was created', async () => {
    await provision();

    expect(opened?.teamId).toEqual(TeamId.of('team_1'));
    expect(opened?.workspaceId).toEqual(WorkspaceId.of('ws_1'));
  });

  it('paints each station the colour its template asked for', async () => {
    await provision();

    expect(seeded?.stations.map((each) => each.color.value)).toEqual(
      DEFAULT_TEMPLATE.stations.map((each) => each.color.value),
    );
  });

  it('seeds that factory with a line off the default template', async () => {
    await provision();

    expect(seeded?.factoryId).toEqual(opened?.id);
    expect(seeded?.name.value).toBe(DEFAULT_TEMPLATE.name.value);
    expect(seeded?.stations.map((each) => each.name.value)).toEqual(
      DEFAULT_TEMPLATE.stations.map((each) => each.name.value),
    );
  });
});
