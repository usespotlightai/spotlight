import { ListLabelsHandler } from '@application/queries/handlers/list-labels.handler';
import { ListLabelsQuery } from '@application/queries/list-labels.query';
import { Label } from '@domain/aggregates/label.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { LabelColour } from '@domain/value-objects/label-colour.vo';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { LabelName } from '@domain/value-objects/label-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const team = () =>
  Team.rehydrate({
    id: TeamId.of('team_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    name: TeamName.of('Platform'),
    members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
  });

const bugLabel = Label.rehydrate({
  id: LabelId.of('label_1'),
  teamId: TeamId.of('team_1'),
  name: LabelName.of('Bug'),
  colour: LabelColour.of('#e11d48'),
});

const featureLabel = Label.rehydrate({
  id: LabelId.of('label_2'),
  teamId: TeamId.of('team_1'),
  name: LabelName.of('Feature'),
  colour: LabelColour.of('#7c3aed'),
});

const labels = (forTeam: Label[] = [bugLabel, featureLabel]) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => null),
    remove: vi.fn(),
    forTeam: vi.fn(async () => forTeam),
    forTask: vi.fn(async () => []),
    attachToTask: vi.fn(),
    detachFromTask: vi.fn(),
  }) satisfies LabelRepository;

const teams = (found: Team | null = team()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    named: vi.fn(async () => found),
    ofWorkspace: vi.fn(async () => (found ? [found] : [])),
    readingFrom: vi.fn(async () => []),
  }) satisfies TeamRepository;

const list = (viewerId = 'user_1', labelRepo = labels(), teamRepo = teams()) =>
  new ListLabelsHandler(labelRepo, teamRepo).execute(
    new ListLabelsQuery('team_1', viewerId),
  );

describe('ListLabelsHandler', () => {
  it("returns all the team's labels", async () => {
    const result = await list();

    expect(result).toHaveLength(2);
    expect(result?.[0]).toEqual({
      id: 'label_1',
      teamId: 'team_1',
      name: 'Bug',
      colour: '#e11d48',
    });
    expect(result?.[1]).toEqual({
      id: 'label_2',
      teamId: 'team_1',
      name: 'Feature',
      colour: '#7c3aed',
    });
  });

  it('returns an empty list when the team has no labels', async () => {
    const result = await list('user_1', labels([]));

    expect(result).toEqual([]);
  });

  it('returns null for a caller not on the team', async () => {
    const result = await list('outsider');

    expect(result).toBeNull();
  });

  it('returns null when the team is not found', async () => {
    const result = await list('user_1', labels(), teams(null));

    expect(result).toBeNull();
  });
});
