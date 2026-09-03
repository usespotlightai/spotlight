import { ProvisionFactory } from '@application/events/handlers/provision-factory.handler';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import { BUILT_IN_STATIONS } from '@domain/services/built-in-stations';
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
      ofWorkspace: vi.fn(async () => []),
      ofTeam: vi.fn(async () => []),
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
});
