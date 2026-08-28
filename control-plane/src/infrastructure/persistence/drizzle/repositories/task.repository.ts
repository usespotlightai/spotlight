import { Task } from '@domain/aggregates/task.aggregate';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

type Row = typeof task.$inferSelect;

const toTask = (row: Row): Task =>
  Task.rehydrate({
    id: TaskId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    stationId: StationId.of(row.stationId),
    title: TaskTitle.of(row.title),
    description: row.description ? TaskDescription.of(row.description) : null,
    rank: TaskRank.of(row.rank),
    createdAt: row.createdAt,
  });

@Injectable()
export class DrizzleTaskRepository implements TaskRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Task): Promise<void> {
    await this.context.db.insert(task).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      stationId: added.stationId.value,
      title: added.title.value,
      description: added.description?.value ?? null,
      rank: added.rank.value,
      createdAt: added.createdAt,
    });
  }

  async save(saved: Task): Promise<void> {
    await this.context.db
      .update(task)
      .set({
        stationId: saved.stationId.value,
        title: saved.title.value,
        description: saved.description?.value ?? null,
        rank: saved.rank.value,
      })
      .where(eq(task.id, saved.id.value));
  }

  async find(id: TaskId): Promise<Task | null> {
    const [found] = await this.context.db
      .select()
      .from(task)
      .where(eq(task.id, id.value))
      .limit(1);

    return found ? toTask(found) : null;
  }

  async standingAt(stationId: StationId): Promise<Task[]> {
    const found = await this.context.db
      .select()
      .from(task)
      .where(eq(task.stationId, stationId.value))
      .orderBy(task.rank);

    return found.map(toTask);
  }
}
