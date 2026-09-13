import { randomUUID } from 'node:crypto';
import { listed } from '@application/services/setup-steps';
import { welcomeTask } from '@domain/services/welcome-task';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import type { DrizzleTaskRepository } from '@infrastructure/persistence/drizzle/repositories/task.repository';
import * as schema from '@infrastructure/persistence/drizzle/schemas';

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

  const factoryId = randomUUID();
  await db
    .insert(schema.factory)
    .values({ id: factoryId, workspaceId, teamId });

  const lineId = randomUUID();
  await db.insert(schema.line).values({
    id: lineId,
    workspaceId,
    factoryId,
    key: 'default',
    name: 'Default',
  });

  await db.insert(schema.station).values({
    id: stationId,
    lineId: lineId,
    key: 'backlog',
    name: 'Backlog',
    position: 0,
  });

  const list = welcomeTask({
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of(teamId),
    saying: TaskNoteBody.of(listed({ slug, teamId })),
    stationId: StationId.of(stationId),
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
    list,
  };
};
