import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { listed } from '@work/application/services/setup-steps';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { welcomeTask } from '@work/domain/services/welcome-task';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import type { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq, inArray } from 'drizzle-orm';
import * as schema from './schema';

const NOW = new Date('2026-01-02T03:04:05.000Z');

export const openTeam = async (
  db: DrizzleDatabase,
  tasks: DrizzleTaskRepository,
  slug: string,
) => {
  const workspaceId = randomUUID();
  const teamId = randomUUID();
  const stationId = randomUUID();
  const owner = randomUUID();

  await db.insert(schema.user).values({
    id: owner,
    name: 'Ada',
    email: `${owner}@example.com`,
  });

  await db
    .insert(schema.workspace)
    .values({ id: workspaceId, name: slug, slug });

  await db
    .insert(schema.workspaceMember)
    .values({ workspaceId, userId: owner, role: 'owner' });

  await db
    .insert(schema.team)
    .values({ id: teamId, workspaceId, key: slug, name: slug });

  await db.insert(schema.teamMember).values({ teamId, userId: owner });

  const lineId = randomUUID();
  await db.insert(schema.line).values({
    id: lineId,
    workspaceId,
    teamId,
    key: 'default',
    name: 'Default',
  });

  const completedId = randomUUID();
  await db.insert(schema.station).values([
    {
      id: stationId,
      lineId: lineId,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    },
    {
      id: completedId,
      lineId: lineId,
      key: 'completed',
      name: 'Completed',
      position: 1,
      kind: 'completed',
    },
  ]);

  const line = Line.rehydrate({
    id: LineId.of(lineId),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of(teamId),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      Station.of({
        id: StationId.of(stationId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.plain(),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of(completedId),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.plain(),
        kind: 'completed',
      }),
    ],
  });

  const list = welcomeTask({
    line,
    teamId: TeamId.of(teamId),
    saying: TaskNoteBody.of(listed()),
    at: StationId.of(stationId),
    station: StationName.of('Backlog'),
    owner: UserId.of(owner),
    now: NOW,
    newId: () => randomUUID(),
  });

  await tasks.add(list);

  return {
    slug,
    owner: UserId.of(owner),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of(teamId),
    stationId: StationId.of(stationId),
    line,
    list,
  };
};

export const seatTeam = async (db: DrizzleDatabase, id: string) => {
  const owner = randomUUID();
  const member = randomUUID();

  await db.insert(schema.user).values([
    { id: owner, name: 'Ada', email: `${owner}@example.com` },
    { id: member, name: 'Bea', email: `${member}@example.com` },
  ]);
  await db.insert(schema.workspace).values({ id, name: id, slug: id });
  await db.insert(schema.workspaceMember).values([
    { workspaceId: id, userId: owner, role: 'owner' },
    { workspaceId: id, userId: member, role: 'member' },
  ]);
  await db
    .insert(schema.team)
    .values({ id, workspaceId: id, key: 'team', name: id });
  await db.insert(schema.teamMember).values([
    { teamId: id, userId: owner },
    { teamId: id, userId: member },
  ]);

  return {
    owner,
    member,
    unseat: async () => {
      await db.delete(schema.task).where(eq(schema.task.workspaceId, id));
      await db.delete(schema.line).where(eq(schema.line.teamId, id));
      await db
        .delete(schema.skillDefinition)
        .where(eq(schema.skillDefinition.teamId, id));
      await db
        .delete(schema.harnessProfile)
        .where(eq(schema.harnessProfile.teamId, id));
      await db.delete(schema.team).where(eq(schema.team.workspaceId, id));
      await db.delete(schema.workspace).where(eq(schema.workspace.id, id));
      await db
        .delete(schema.user)
        .where(inArray(schema.user.id, [owner, member]));
    },
  };
};
